import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Variabel global untuk mengatur waktu animasi angin pada material
export const windUniforms = { time: { value: 0 } };
// Variabel global untuk mengirim posisi player ke shader rumput (Efek Interaksi Injak)
export const interactionUniforms = { playerPos: { value: new THREE.Vector3(0, -1000, 0) } };

/**
 * Pengelola Karakter Pemain
 * Mengatasi logika fisika, animasi, pergerakan dengan inersia, serta interaksi lingkungan.
 */
export class Player {
    constructor(scene) {
        this.scene = scene;

        // Container utama model karakter
        this.model = new THREE.Group();
        this.model.position.set(0, 5, 10);
        this.scene.add(this.model);

        // Parameter pergerakan & fisika
        this.moveSpeed = 8.0;
        this.currentVelocity = new THREE.Vector3(); // Menyimpan kelajuan linier untuk efek inersia
        this.yVelocity = 0;
        this.isGrounded = false;
        this.jumpCount = 0;
        this.gravity = -30.0;
        this.jumpForce = 15.0;
        this.wasSpacePressed = false;

        // Parameter animasi
        this.mixer = null;
        this.animations = [];
        this.currentAction = null;
        this.animMap = { idle: null, walk: null, run: null, jump: null };
        this.currentAnimState = 'idle';

        // Memuat model karakter utama
        this.loadGenshinCharacter('/assets/models/characters/Karakter_Gensin.glb');
    }

    /**
     * Memuat file model utama Genshin GLB
     * @param {string} path - Jalur direktori aset model
     */
    loadGenshinCharacter(path) {
        const fileName = path.split('/').pop();
        const loader = new GLTFLoader();
        loader.load(
            path,
            (gltf) => {
                const characterMesh = gltf.scene;
                this.applyMaterialFixes(characterMesh, fileName);
                this.model.add(characterMesh);

                this.animations = gltf.animations;
                if (this.animations && this.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(characterMesh);
                    this.setupAnimationSelects();
                }
            },
            undefined,
            (error) => {
                console.error('Gagal memuat model Karakter_Gensin.glb:', error);
            }
        );
    }

    /**
     * Memperbaiki pengaturan material pada aset 3D dan menginjeksi animasi angin
     * @param {THREE.Object3D} model - Objek model 3D
     * @param {string} fileName - Nama file aset untuk filter material
     */
    applyMaterialFixes(model, fileName = '') {
        const fileStr = fileName.toLowerCase();

        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                const meshName = (child.name || '').toLowerCase();
                
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        
                        if (mat.userData.isFixed) return;
                        mat.userData.isFixed = true;

                        const matName = (mat.name || '').toLowerCase();
                        const combinedName = meshName + ' ' + matName + ' ' + fileStr;

                        const isCharacter = combinedName.includes('karakter') || combinedName.includes('gensin');
                        const isDead = combinedName.includes('dead');
                        const isTrunkOrWood = combinedName.includes('trunk') || combinedName.includes('bark') || combinedName.includes('wood') || combinedName.includes('branch') || combinedName.includes('log');
                        const isArchitecture = combinedName.includes('house') || combinedName.includes('wall') || combinedName.includes('building') || combinedName.includes('rock') || combinedName.includes('stone');
                        
                        const isSolid = isArchitecture || isTrunkOrWood || isDead || isCharacter;

                        const isTree = combinedName.includes('tree');
                        const isShortFoliage = combinedName.includes('grass') || combinedName.includes('bush') || combinedName.includes('flower') || combinedName.includes('clover') || combinedName.includes('plant') || combinedName.includes('leaf') || combinedName.includes('foliage');
                        
                        const isFoliage = (isTree || isShortFoliage) && !isSolid;
                        const isPushable = isShortFoliage && !isTree && !isSolid;

                        mat.side = THREE.DoubleSide;
                        if (mat.transparent || mat.alphaMap || (mat.map && mat.map.format === THREE.RGBAFormat)) {
                            mat.transparent = false;
                            mat.alphaTest = 0.5;
                            mat.depthWrite = true;
                        }
                        if (mat.opacity === 0) mat.opacity = 1;

                        if (isFoliage) {
                            child.geometry.computeBoundingBox();
                            const bbox = child.geometry.boundingBox;
                            const localMinY = bbox.min.y;
                            const localHeight = (bbox.max.y - bbox.min.y) || 0.001;

                            mat.onBeforeCompile = (shader) => {
                                shader.uniforms.windTime = windUniforms.time;
                                
                                if (isPushable) {
                                    shader.uniforms.playerPos = interactionUniforms.playerPos;
                                }
                                
                                shader.vertexShader = `
                                    uniform float windTime;
                                    ${isPushable ? 'uniform vec3 playerPos;' : ''}
                                    float localMinY = ${localMinY.toFixed(5)};
                                    float localHeight = ${localHeight.toFixed(5)};
                                    ${shader.vertexShader}
                                `;
                                shader.vertexShader = shader.vertexShader.replace(
                                    '#include <begin_vertex>',
                                    `
                                    #include <begin_vertex>
                                    
                                    // 1. Kalkulasi Rasio Tinggi Relatif
                                    float normY = clamp((position.y - localMinY) / localHeight, 0.0, 1.0);
                                    
                                    vec4 worldPosWind = modelMatrix * vec4(position, 1.0);
                                    
                                    // 2. Efek Goyangan Angin Alami
                                    ${isTree ? `
                                    float swayMultiplier = pow(normY, 2.0) * 0.15;
                                    ` : `
                                    float swayMultiplier = normY * 0.15;
                                    `}
                                    
                                    float windX = sin(windTime * 2.0 + worldPosWind.x * 0.5 + worldPosWind.z * 0.5) * swayMultiplier;
                                    float windZ = cos(windTime * 1.5 + worldPosWind.x * 0.5 + worldPosWind.z * 0.5) * swayMultiplier;
                                    
                                    ${isPushable ? `
                                    // 3. Efek Fisika Interaksi Injakan Pemain
                                    float distXZ = distance(worldPosWind.xz, playerPos.xz);
                                    float distY = abs(worldPosWind.y - (playerPos.y + 0.5));
                                    float interactRadius = 0.85; 
                                    
                                    if (distXZ < interactRadius && distY < 1.5 && normY > 0.0) {
                                        float pushFactor = clamp(1.0 - (distXZ / interactRadius), 0.0, 1.0);
                                        float pushStrength = pushFactor * pushFactor * 0.7; 
                                        
                                        vec2 pushDir = normalize(worldPosWind.xz - playerPos.xz);
                                        if (length(worldPosWind.xz - playerPos.xz) < 0.001) pushDir = vec2(1.0, 0.0);
                                        
                                        float bend = pushStrength * normY;
                                        
                                        windX += pushDir.x * bend;
                                        windZ += pushDir.y * bend;
                                        
                                        transformed.y -= (bend * 0.3);
                                    }
                                    ` : ''}
                                    
                                    transformed.x += windX;
                                    transformed.z += windZ;
                                    `
                                );
                            };
                        }
                    });
                }
            }
        });
    }

    /**
     * Memuat model kustom baru apabila diunggah oleh pengguna
     * @param {GLTF} gltf - Objek GLTF terurai
     * @param {string} fileName - Nama file model
     */
    loadCustomCharacter(gltf, fileName = '') {
        while (this.model.children.length > 0) {
            this.model.remove(this.model.children[0]);
        }

        const characterMesh = gltf.scene;
        this.applyMaterialFixes(characterMesh, fileName);
        this.model.add(characterMesh);

        this.animations = gltf.animations;
        if (this.animations && this.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(characterMesh);
            this.setupAnimationSelects();
        } else {
            this.mixer = null;
        }
    }

    /**
     * Mengatur elemen pemilih animasi di UI Editor
     */
    setupAnimationSelects() {
        const menu = document.getElementById('anim-config-menu');
        if (menu) menu.style.display = 'flex';

        const selects = {
            idle: document.getElementById('sel-idle'),
            walk: document.getElementById('sel-walk'),
            run: document.getElementById('sel-run'),
            jump: document.getElementById('sel-jump')
        };

        for (let key in selects) {
            if (selects[key]) {
                selects[key].innerHTML = '<option value="">-- Pilih --</option>';
            }
            this.animMap[key] = null;
        }

        this.animations.forEach((clip, index) => {
            let name = clip.name.toLowerCase();
            for (let key in selects) {
                if (selects[key]) {
                    let opt = document.createElement('option');
                    opt.value = index;
                    opt.text = clip.name;
                    selects[key].appendChild(opt);
                    if (!this.animMap[key] && name.includes(key)) {
                        this.animMap[key] = clip;
                        selects[key].value = index;
                    }
                }
            }
        });

        for (let key in selects) {
            if (selects[key]) {
                selects[key].onchange = (e) => {
                    let idx = e.target.value;
                    this.animMap[key] = idx !== "" ? this.animations[idx] : null;
                    if (this.currentAnimState === key) {
                        this.currentAnimState = null;
                        this.playAnimation(key);
                    }
                };
            }
        }
        this.playAnimation('idle');
    }

    /**
     * Memainkan animasi karakter dengan transisi crossfade yang halus
     * @param {string} state - Nama status animasi ('idle', 'walk', 'run', 'jump')
     */
    playAnimation(state) {
        if (!this.mixer || this.currentAnimState === state) return;
        
        const clip = this.animMap[state];
        if (!clip) return;

        this.currentAnimState = state;
        const nextAction = this.mixer.clipAction(clip);

        if (this.currentAction) {
            // Transisi halus berdurasi 0.2 detik antar animasi
            this.currentAction.crossFadeTo(nextAction, 0.2, true);
        }
        
        nextAction.reset().play();
        this.currentAction = nextAction;
    }

    /**
     * Memperbarui fisika, pergerakan inersia, rotasi, dan deteksi daratan
     * @param {number} delta - Selisih waktu antar frame
     * @param {Object} inputState - Status input kontroler
     * @param {number} cameraAngle - Sudut kamera horizontal
     * @param {World} world - Objek lingkungan dunia
     */
    updatePhysics(delta, inputState, cameraAngle, world) {
        if (!this.model) return;

        // Update animasi mixer
        if (this.mixer) this.mixer.update(delta);

        // Update koordinat posisi pemain untuk interaksi shader rumput
        interactionUniforms.playerPos.value.copy(this.model.position);

        // Logika Lompat
        if (inputState.keys.space && !this.wasSpacePressed) {
            if (this.jumpCount < 2) {
                this.yVelocity = this.jumpForce;
                this.jumpCount++;
                this.isGrounded = false;
            }
        }
        this.wasSpacePressed = inputState.keys.space;

        // Menyusun daftar mesh rintangan dan lantai
        let allCollisionMeshes = [...world.baseObstacleMeshes];
        world.placedAssetsList.forEach(a => {
            const name = (a.mesh.name || '').toLowerCase();
            const isPassable = name.includes('grass') || name.includes('bush') || name.includes('flower') || name.includes('clover') || name.includes('plant');
            
            if (!isPassable) {
                allCollisionMeshes.push(a.mesh);
            }
        });
        
        let allTargets = [world.floorMesh, ...allCollisionMeshes];

        // Gravitasi Vertikal
        this.yVelocity += this.gravity * delta;

        // Deteksi Pijakan Bawah (Ground Raycast)
        const downRay = new THREE.Raycaster(
            new THREE.Vector3(this.model.position.x, this.model.position.y + 1.0, this.model.position.z),
            new THREE.Vector3(0, -1, 0),
            0, 10
        );
        const groundIntersects = downRay.intersectObjects(allTargets, true);

        let surfaceHeight = -Infinity;
        for (let i = 0; i < groundIntersects.length; i++) {
            if (groundIntersects[i].point.y <= this.model.position.y + 0.6) {
                surfaceHeight = groundIntersects[i].point.y;
                break;
            }
        }

        this.isGrounded = false;
        let nextY = this.model.position.y + this.yVelocity * delta;

        if (nextY <= surfaceHeight) {
            this.yVelocity = 0;
            this.model.position.y = surfaceHeight;
            this.isGrounded = true;
            this.jumpCount = 0;
        } else {
            this.model.position.y = nextY;
        }

        // Kalkulasi Input Arah Arah (WASD / Analog Mobile)
        let currentSpeed = (inputState.keys.shift || inputState.isJoySprinting) ? this.moveSpeed * 1.8 : this.moveSpeed;
        let moveX = inputState.joyMoveX;
        let moveZ = inputState.joyMoveZ;

        if (inputState.keys.w) moveZ = -1;
        if (inputState.keys.s) moveZ = 1;
        if (inputState.keys.a) moveX = -1;
        if (inputState.keys.d) moveX = 1;

        // Vektor Kecepatan Target
        const targetVelocity = new THREE.Vector3(0, 0, 0);

        if (moveX !== 0 || moveZ !== 0) {
            let length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            moveX /= length; moveZ /= length;

            let s = Math.sin(cameraAngle);
            let c = Math.cos(cameraAngle);

            targetVelocity.x = (moveX * c + moveZ * s) * currentSpeed;
            targetVelocity.z = (moveX * -s + moveZ * c) * currentSpeed;
        }

        // AKSELERASI & DESELERASI HALUS (Inersia Pergerakan)
        const lerpFactor = 1.0 - Math.exp(-12.0 * delta); // Independen terhadap FPS
        this.currentVelocity.lerp(targetVelocity, lerpFactor);

        // Penerapan Pergerakan Sumbu X dengan Raycast Tabrakan
        let finalMoveX = this.currentVelocity.x * delta;
        if (Math.abs(finalMoveX) > 0.0001) {
            let dirX = new THREE.Vector3(Math.sign(finalMoveX), 0, 0);
            let rayX = new THREE.Raycaster(
                new THREE.Vector3(this.model.position.x, this.model.position.y + 1, this.model.position.z),
                dirX, 0, 0.6 + Math.abs(finalMoveX)
            );
            if (rayX.intersectObjects(allCollisionMeshes, true).length === 0) {
                this.model.position.x += finalMoveX;
            } else {
                this.currentVelocity.x = 0; // Hentikan inersia jika menabrak
            }
        }

        // Penerapan Pergerakan Sumbu Z dengan Raycast Tabrakan
        let finalMoveZ = this.currentVelocity.z * delta;
        if (Math.abs(finalMoveZ) > 0.0001) {
            let dirZ = new THREE.Vector3(0, 0, Math.sign(finalMoveZ));
            let rayZ = new THREE.Raycaster(
                new THREE.Vector3(this.model.position.x, this.model.position.y + 1, this.model.position.z),
                dirZ, 0, 0.6 + Math.abs(finalMoveZ)
            );
            if (rayZ.intersectObjects(allCollisionMeshes, true).length === 0) {
                this.model.position.z += finalMoveZ;
            } else {
                this.currentVelocity.z = 0; // Hentikan inersia jika menabrak
            }
        }

        // ROTASI BERSKALA DELTA TIME (Mencegah Karakter Terbalik/Moonwalk)
        if (this.currentVelocity.lengthSq() > 0.1) {
            let targetAngle = Math.atan2(this.currentVelocity.x, this.currentVelocity.z) + Math.PI;
            let targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
            
            const rotateSpeed = 1.0 - Math.exp(-15.0 * delta);
            this.model.quaternion.slerp(targetQuaternion, rotateSpeed);
        }

        // Manajemen Status Animasi Berdasarkan Gerakan Real-time
        const horizontalSpeed = Math.sqrt(this.currentVelocity.x * this.currentVelocity.x + this.currentVelocity.z * this.currentVelocity.z);

        if (!this.isGrounded) {
            this.playAnimation('jump');
        } else if (horizontalSpeed > 0.5) {
            this.playAnimation(horizontalSpeed > this.moveSpeed * 1.2 ? 'run' : 'walk');
        } else {
            this.playAnimation('idle');
        }
    }
}