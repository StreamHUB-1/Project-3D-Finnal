import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * World Manager
 * Memuat dan mengelola Map Utama 3D serta sinkronisasi Collider Fisika Rapier Presisi Dunia
 */
export class World {
    constructor(scene, loadingManager = null, rapierWorld = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.rapierWorld = rapierWorld;

        // Container utama untuk Map yang juga berfungsi sebagai target Raycast/Floor
        this.floorMesh = new THREE.Group();
        this.floorMesh.name = "MainMapGroup";
        this.scene.add(this.floorMesh);

        this.baseObstacleMeshes = [];
        this.placedAssetsList = [];
        this.mapColliders = [];

        this.isMapLoaded = false;

        this.loadMainMap();
    }

    /**
     * Memuat file 3D Map dari public/assets/models/maps/main_map.glb dan mendaftarkan collider fisik akurat ke Rapier
     */
    loadMainMap() {
        const loader = new GLTFLoader(this.loadingManager);
        const mapPath = '/assets/models/maps/main_map.glb';

        loader.load(
            mapPath,
            (gltf) => {
                const mapModel = gltf.scene;
                mapModel.name = "LA_Gangwar_Simulator_Map";

                // PENYESUAIAN SKALA MAP: Diturunkan ke 2.0x agar proporsional dengan tinggi karakter
                mapModel.scale.set(2.0, 2.0, 2.0);
                mapModel.updateMatrixWorld(true);

                // Traverse seluruh mesh di dalam map untuk bayangan, material, & pembuatan collider fisik dunia nyata
                mapModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        if (child.material) {
                            child.material.needsUpdate = true;
                            child.material.side = THREE.DoubleSide;
                        }

                        this.baseObstacleMeshes.push(child);

                        // Buat Collider Fisika Rapier berbasis World Matrix yang presisi
                        if (this.rapierWorld && child.geometry) {
                            try {
                                // Clone geometri dan terapkan matriks dunia agar posisinya pas di tempatnya
                                const geom = child.geometry.clone();
                                geom.applyMatrix4(child.matrixWorld);

                                // FIX RAPIER MEMORY: Konversi paksa data memori Three.js ke format yang dikenali Rapier WASM
                                const vertices = new Float32Array(geom.attributes.position.array);
                                let indices;
                                
                                if (geom.index) {
                                    indices = new Uint32Array(geom.index.array); // Paksa ke Uint32Array
                                } else {
                                    const vertCount = Math.floor(vertices.length / 3);
                                    indices = new Uint32Array(vertCount);
                                    for (let i = 0; i < vertCount; i++) indices[i] = i;
                                }

                                if (vertices && vertices.length > 0) {
                                    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
                                    const bodyDesc = RAPIER.RigidBodyDesc.fixed();
                                    const body = this.rapierWorld.createRigidBody(bodyDesc);
                                    const collider = this.rapierWorld.createCollider(colliderDesc, body);
                                    this.mapColliders.push(collider);
                                }
                            } catch (err) {
                                console.warn("[WorldPhysics] Gagal membuat collider untuk mesh map:", err);
                            }
                        }
                    }
                });

                this.floorMesh.add(mapModel);
                this.isMapLoaded = true;
                console.log("[World] Map Utama berhasil dimuat dan collider Rapier disinkronkan presisi!");
            },
            (xhr) => {
                if (xhr.lengthComputable) {
                    const percent = (xhr.loaded / xhr.total) * 100;
                    console.log(`Proses Memuat Map: ${Math.round(percent)}%`);
                }
            },
            (error) => {
                console.error("Gagal memuat map utama dari path " + mapPath + ":", error);
            }
        );
    }

    sculptTerrain(point, brushSize, tool, delta, isLeftClick, isRightMouseDown) {}
    paintTerrainTexture(uv, brushSize, textureImage) {}
}