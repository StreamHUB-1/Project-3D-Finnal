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
    constructor(scene, loadingManager = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;

        // Container utama model karakter
        this.model = new THREE.Group();
        
        // POSISI SPAWN AWAL PRESISI: X: 372, Y: 3.0, Z: -115
        this.model.position.set(372, 3.0, -115);
        
        // Mengatur arah rotasi awal karakter agar menghadap ke Selatan (South / S)
        this.model.rotation.y = Math.PI;

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

        // FLAG KESIAPAN: Mencegah jatuh sebelum map selesai ter-load
        this.isReady = false;

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
        const loader = new GLTFLoader(this.loadingManager);
        loader.load(
            path,
            (gltf) => {
                const characterMesh = gltf.scene;
                this.applyMaterialFixes(characterMesh, fileName);
                
                // Skala Karakter Standar 1.0
                characterMesh.scale.set(1.0, 1.0, 1.0);

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

                        // OPTIMALISASI RENDER: Hanya gunakan DoubleSide untuk vegetasi/transparan agar menghemat daya GPU
                        if (isFoliage || mat.transparent || mat.alphaMap) {
                            mat.side = THREE.DoubleSide;
                        } else {
                            mat.side = THREE.FrontSide;
                        }

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

        // =========================================================
        // MEKANISME INSTANT GROUND SNAP PADA KOORDINAT SPAWN TARGET
        // =========================================================
        if (!this.isReady) {
            if (!world.isMapLoaded) {
                // Tahan di Y = 3.0 tanpa gravitasi saat map belum siap
                this.model.position.set(372, 3.0, -115);
                this.yVelocity = 0;
                return;
            }

            // Raycast ditembakkan langsung dari Y=500 pada posisi X: 372, Z: -115 untuk mencari permukaan tanah
            const spawnRay = new THREE.Raycaster(
                new THREE.Vector3(372, 500, -115),
                new THREE.Vector3(0, -1, 0),
                0, 1000
            );
            const hits = spawnRay.intersectObjects(allTargets, true);

            if (hits.length > 0) {
                // Tempelkan posisi karakter secara presisi di atas permukaan tanah/jalan
                this.model.position.set(372, hits[0].point.y + 0.05, -115);
                this.yVelocity = 0;
                this.isGrounded = true;
                this.isReady = true;
                console.log("Karakter berhasil di-snap di posisi X: 372, Z: -115 dengan Y:", hits[0].point.y);
            } else {
                // Fallback default pada koordinat target jika belum ada permukaan terdeteksi
                this.model.position.set(372, 3.0, -115);
            }
            return;
        }

        // SAFETY NET (RESCUE TELEPORT): Jika karakter jatuh menembus batas bawah map atau melayang ekstrem
        if (this.model.position.y > 100 || this.model.position.y < -50) {
            const rescueRay = new THREE.Raycaster(
                new THREE.Vector3(372, 500, -115),
                new THREE.Vector3(0, -1, 0),
                0, 1000
            );
            const rescueHits = rescueRay.intersectObjects(allTargets, true);
            if (rescueHits.length > 0) {
                this.model.position.set(372, rescueHits[0].point.y + 0.5, -115);
                this.yVelocity = 0;
            } else {
                this.model.position.set(372, 3.0, -115);
                this.isReady = false;
            }
            return;
        }

        // Logika Lompat
        if (inputState.keys.space && !this.wasSpacePressed) {
            if (this.jumpCount < 2) {
                this.yVelocity = this.jumpForce;
                this.jumpCount++;
                this.isGrounded = false;
            }
        }
        this.wasSpacePressed = inputState.keys.space;

        // Gravitasi Vertikal
        this.yVelocity += this.gravity * delta;

        // =========================================================
        // DETEKSI KEPENTOK ATAP/KANOPI (CEILING COLLISION CHECK)
        // =========================================================
        if (this.yVelocity > 0) {
            const headRay = new THREE.Raycaster(
                new THREE.Vector3(this.model.position.x, this.model.position.y + 1.2, this.model.position.z),
                new THREE.Vector3(0, 1, 0),
                0, 0.7 + Math.abs(this.yVelocity * delta)
            );
            const headHits = headRay.intersectObjects(allTargets, true);
            if (headHits.length > 0) {
                // Memantulkan atau menghentikan lompatan begitu kepala menabrak kanopi/atap
                this.yVelocity = -2.0;
            }
        }

        // =========================================================
        // DETEKSI PIJAKAN BAWAH & GROUND SNAPPING MIRING (GENTENG)
        // =========================================================
        const rayOffset = this.isGrounded ? 1.5 : 1.2;
        const rayLength = this.isGrounded ? 2.2 : 20.0;

        const downRay = new THREE.Raycaster(
            new THREE.Vector3(this.model.position.x, this.model.position.y + rayOffset, this.model.position.z),
            new THREE.Vector3(0, -1, 0),
            0, rayLength
        );
        const groundIntersects = downRay.intersectObjects(allTargets, true);

        let surfaceHeight = -Infinity;
        let isTooSteep = false;
        let slopeNormal = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i < groundIntersects.length; i++) {
            const hit = groundIntersects[i];
            if (hit.point.y <= this.model.position.y + 1.2) {
                surfaceHeight = hit.point.y;

                // Cek sudut kemiringan permukaan (genteng/atap)
                if (hit.face) {
                    const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                    slopeNormal.copy(worldNormal);
                    const angle = worldNormal.angleTo(new THREE.Vector3(0, 1, 0));
                    // Jika sudut kemiringan > 50 derajat (0.87 Radian), bidang dianggap terlalu terjal
                    if (angle > 0.87) {
                        isTooSteep = true;
                    }
                }
                break;
            }
        }

        let nextY = this.model.position.y + this.yVelocity * delta;

        // Ground Snapping Logic: Kunci kaki di permukaan jika penurunan miring wajar
        const snapThreshold = this.isGrounded ? 0.6 : 0.05;

        if (surfaceHeight !== -Infinity && (nextY <= surfaceHeight || (this.isGrounded && this.model.position.y - surfaceHeight <= snapThreshold))) {
            if (isTooSteep && !this.isGrounded) {
                // Jika genteng/permukaan terlalu miring terjal, karakter merosot turun
                this.yVelocity = Math.min(this.yVelocity, -8.0);
                this.model.position.y = nextY;
                this.currentVelocity.x += slopeNormal.x * 6.0 * delta;
                this.currentVelocity.z += slopeNormal.z * 6.0 * delta;
            } else {
                this.yVelocity = 0;

                // PERHALUS TRANSISI PERMUKAAN TANAH/TANGGA/GENTENG (LERP)
                const targetY = surfaceHeight;
                const smoothFactor = 1.0 - Math.exp(-25.0 * delta);
                this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, targetY, smoothFactor);

                this.isGrounded = true;
                this.jumpCount = 0;
            }
        } else {
            this.isGrounded = false;
            this.model.position.y = nextY;
        }

        // Kalkulasi Input Arah (WASD / Analog Mobile)
        let moveX = inputState.joyMoveX;
        let moveZ = inputState.joyMoveZ;

        if (inputState.keys.w) moveZ = -1;
        if (inputState.keys.s) moveZ = 1;
        if (inputState.keys.a) moveX = -1;
        if (inputState.keys.d) moveX = 1;

        let isSprinting = inputState.keys.shift || inputState.isJoySprinting;

        // PENANGANAN FITUR AUTO-RUN (PC & HP)
        if (inputState.isAutoRun) {
            moveZ = -1; // Memaksa karakter berjalan/berlari maju
            isSprinting = true; // Otomatis berlari kencang
        }

        let currentSpeed = isSprinting ? this.moveSpeed * 1.8 : this.moveSpeed;

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

        // =========================================================
        // LOGIKA TABRAKAN PRESISI & STEP-UP (TROTOAR/TANGGA) VS PAGAR
        // =========================================================
        const maxStepHeight = 0.45; // Maksimal tinggi trotoar/anak tangga (0.45m)
        const moveDistX = 0.35 + Math.abs(this.currentVelocity.x * delta);
        const moveDistZ = 0.35 + Math.abs(this.currentVelocity.z * delta);

        // --- PENERAPAN PERGERAKAN SUMBU X ---
        let finalMoveX = this.currentVelocity.x * delta;
        if (Math.abs(finalMoveX) > 0.0001) {
            let dirX = new THREE.Vector3(Math.sign(finalMoveX), 0, 0);
            let perpX = new THREE.Vector3(0, 0, 1);

            // 3 Titik Samping (Tengah, Kiri, Kanan)
            let offsets = [0, -0.22, 0.22];
            let footHit = false;
            let stepHit = false;
            let waistHit = false;

            for (let off of offsets) {
                let startPos = new THREE.Vector3().copy(this.model.position).addScaledVector(perpX, off);

                let footRay = new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + 0.1, startPos.z), dirX, 0, moveDistX);
                let stepRay = new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + maxStepHeight, startPos.z), dirX, 0, moveDistX);
                let waistRay = new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + 1.0, startPos.z), dirX, 0, moveDistX);

                if (footRay.intersectObjects(allTargets, true).length > 0) footHit = true;
                if (stepRay.intersectObjects(allTargets, true).length > 0) stepHit = true;
                if (waistRay.intersectObjects(allTargets, true).length > 0) waistHit = true;
            }

            if (footHit && !stepHit && !waistHit) {
                // Kaki nabrak TAPI area Step (0.45m) & Pinggang Kosong -> Step-Up Tangga/Trotoar
                const stepCheckRay = new THREE.Raycaster(
                    new THREE.Vector3(this.model.position.x + dirX.x * moveDistX, this.model.position.y + maxStepHeight + 0.5, this.model.position.z),
                    new THREE.Vector3(0, -1, 0), 0, maxStepHeight + 0.6
                );
                const checkHits = stepCheckRay.intersectObjects(allTargets, true);
                if (checkHits.length > 0 && checkHits[0].point.y <= this.model.position.y + maxStepHeight + 0.05) {
                    const targetStepY = checkHits[0].point.y + 0.02;
                    this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, targetStepY, 1.0 - Math.exp(-20.0 * delta));
                    this.model.position.x += finalMoveX;
                    this.yVelocity = 0;
                    this.isGrounded = true;
                } else {
                    this.currentVelocity.x = 0;
                }
            } else if (!footHit && !stepHit && !waistHit) {
                this.model.position.x += finalMoveX;
            } else {
                // Ada tembok/pagar yang menghalangi -> Berhenti
                this.currentVelocity.x = 0;
            }
        }

        // --- PENERAPAN PERGERAKAN SUMBU Z ---
        let finalMoveZ = this.currentVelocity.z * delta;
        if (Math.abs(finalMoveZ) > 0.0001) {
            let dirZ = new THREE.Vector3(0, 0, Math.sign(finalMoveZ));
            let perpZ = new THREE.Vector3(1, 0, 0);

            let offsets = [0, -0.22, 0.22];
            let footHit = false;
            let stepHit = false;
            let waistHit = false;

            for (let off of offsets) {
                let startPos = new THREE.Vector3().copy(this.model.position).addScaledVector(perpZ, off);

                let footRay = new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + 0.1, startPos.z), dirZ, 0, moveDistZ);
                let stepRay = new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + maxStepHeight, startPos.z), dirZ, 0, moveDistZ);
                let waistRay = new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + 1.0, startPos.z), dirZ, 0, moveDistZ);

                if (footRay.intersectObjects(allTargets, true).length > 0) footHit = true;
                if (stepRay.intersectObjects(allTargets, true).length > 0) stepHit = true;
                if (waistRay.intersectObjects(allTargets, true).length > 0) waistHit = true;
            }

            if (footHit && !stepHit && !waistHit) {
                // Kaki nabrak TAPI area Step (0.45m) & Pinggang Kosong -> Step-Up Tangga/Trotoar
                const stepCheckRay = new THREE.Raycaster(
                    new THREE.Vector3(this.model.position.x, this.model.position.y + maxStepHeight + 0.5, this.model.position.z + dirZ.z * moveDistZ),
                    new THREE.Vector3(0, -1, 0), 0, maxStepHeight + 0.6
                );
                const checkHits = stepCheckRay.intersectObjects(allTargets, true);
                if (checkHits.length > 0 && checkHits[0].point.y <= this.model.position.y + maxStepHeight + 0.05) {
                    const targetStepY = checkHits[0].point.y + 0.02;
                    this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, targetStepY, 1.0 - Math.exp(-20.0 * delta));
                    this.model.position.z += finalMoveZ;
                    this.yVelocity = 0;
                    this.isGrounded = true;
                } else {
                    this.currentVelocity.z = 0;
                }
            } else if (!footHit && !stepHit && !waistHit) {
                this.model.position.z += finalMoveZ;
            } else {
                // Ada tembok/pagar yang menghalangi -> Berhenti
                this.currentVelocity.z = 0;
            }
        }

        // ROTASI BERSKALA DELTA TIME
        if (this.currentVelocity.lengthSq() > 0.1) {
            let targetAngle = Math.atan2(this.currentVelocity.x, this.currentVelocity.z) + Math.PI;
            let targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
            
            const rotateSpeed = 1.0 - Math.exp(-15.0 * delta);
            this.model.quaternion.slerp(targetQuaternion, rotateSpeed);
        }

        // Manajemen Status Animasi
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