import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * World Manager
 * Memuat dan mengelola Map Utama 3D (LA Gangwar Simulator)
 */
export class World {
    constructor(scene, loadingManager = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;

        // Container utama untuk Map yang juga berfungsi sebagai target Raycast/Floor
        this.floorMesh = new THREE.Group();
        this.floorMesh.name = "MainMapGroup";
        this.scene.add(this.floorMesh);

        this.baseObstacleMeshes = [];
        this.placedAssetsList = [];

        this.isMapLoaded = false;

        this.loadMainMap();
    }

    /**
     * Memuat file 3D Map dari public/assets/models/maps/main_map.glb
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

                // Traverse seluruh mesh di dalam map untuk bayangan, material, & kolisi
                mapModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        if (child.material) {
                            child.material.needsUpdate = true;
                            // Memastikan material memiliki dua sisi agar interior rumah/dinding tidak tembus
                            child.material.side = THREE.DoubleSide;
                        }
                    }
                });

                this.floorMesh.add(mapModel);
                this.isMapLoaded = true;
                console.log("Map Utama LA Gangwar Simulator berhasil dimuat dengan skala 2.0x!");
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

    /**
     * Stub aman untuk mencegah error jika tool sculpt dipanggil pada map GLTF
     */
    sculptTerrain(point, brushSize, tool, delta, isLeftClick, isRightMouseDown) {
        // Map 3D GLTF eksternal tidak diubah struktur vertex-nya secara langsung
    }

    /**
     * Stub aman untuk mencegah error jika tool paint dipanggil pada map GLTF
     */
    paintTerrainTexture(uv, brushSize, textureImage) {
        // Map 3D GLTF eksternal menggunakan material bawaan model
    }
}