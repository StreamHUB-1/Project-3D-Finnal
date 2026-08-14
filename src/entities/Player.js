import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Variabel global untuk mengatur waktu animasi angin pada material
export const windUniforms = { time: { value: 0 } };
// Variabel global untuk mengirim posisi player ke shader rumput (Efek Interaksi Injak)
export const interactionUniforms = { playerPos: { value: new THREE.Vector3(0, -1000, 0) } };

/**
 * Pengelola Karakter Pemain
 * Mengatasi logika fisika, animasi, pergerakan dengan inersia, interaksi lingkungan, audio, serta VFX Partikel.
 */
export class Player {
    constructor(scene, loadingManager = null, audioManager = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.audio = audioManager; // Integrasi Audio Manager

        // Container utama model karakter
        this.model = new THREE.Group();
        
        // POSISI SPAWN AWAL PRESISI: X: 372, Y: 3.0, Z: -115
        this.model.position.set(372, 3.0, -115);
        
        // Mengatur arah rotasi awal karakter agar menghadap ke Selatan (South / S)
        this.model.rotation.y = Math.PI;

        this.scene.add(this.model);

        // Parameter pergerakan & fisika terkalibrasi ala game AAA
        this.moveSpeed = 4.5; 
        this.sprintMultiplier = 3.0; 
        this.currentVelocity = new THREE.Vector3(); 
        this.yVelocity = 0;
        this.isGrounded = false;
        this.wasGroundedPrev = false; 
        this.lastGroundedY = 3.0; // Menyimpan ketinggian tanah terakhir untuk perhitungan panjat
        this.gravity = -27.0; // Gravitasi natural berbobot
        this.jumpForce = 12.2; // Gaya lompatan natural proporsional skala 1.8
        this.wasSpacePressed = false;
        
        // State Aksi Khusus (Roll, Slide, Climb/Vault)
        this.isRolling = false;
        this.rollTimer = 0;
        this.isSliding = false;
        this.slideTimer = 0;
        this.isClimbing = false;
        this.climbTimer = 0;
        this.climbDuration = 0.8;
        this.climbStartPos = new THREE.Vector3();
        this.climbTargetPos = new THREE.Vector3();

        // Parameter Stamina (Maksimal 100)
        this.stamina = 100;
        this.maxStamina = 100;

        // Timer untuk ritme langkah kaki & Partikel
        this.footstepTimer = 0;
        this.dustTimer = 0;

        // FLAG KESIAPAN
        this.isReady = false;

        // Parameter animasi
        this.mixer = null;
        this.animations = [];
        this.currentAction = null;
        
        // Memperluas slot peta animasi
        this.animMap = { 
            idle: null, walk: null, run: null, jump: null, sneak: null,
            roll: null, climbDown: null, wallClimb: null, crawl: null,
            swim: null, swimIdle: null, fly: null, slide: null, hit: null,
            pickup: null, plant: null, gather: null, drink: null, 
            enterCar: null, exitCar: null, drive: null
        };
        this.currentAnimState = null;

        // Inisialisasi Sistem Partikel Debu
        this.initDustParticles();

        // Memuat model karakter utama
        this.loadGenshinCharacter('/assets/models/characters/Karakter_Utama.glb');
    }

    createDustTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    initDustParticles() {
        this.particleCount = 50; 
        this.particlesData = [];
        
        const positions = new Float32Array(this.particleCount * 3);
        const opacities = new Float32Array(this.particleCount);
        const scales = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            this.particlesData.push({ life: 0, maxLife: 1, vel: new THREE.Vector3() });
            positions[i*3] = 0; positions[i*3+1] = -1000; positions[i*3+2] = 0; 
            opacities[i] = 0;
            scales[i] = 1;
        }

        this.particleGeo = new THREE.BufferGeometry();
        this.particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particleGeo.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
        this.particleGeo.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

        const shaderMaterial = new THREE.ShaderMaterial({
            uniforms: { uTexture: { value: this.createDustTexture() } },
            vertexShader: `
                attribute float opacity;
                attribute float scale;
                varying float vOpacity;
                void main() {
                    vOpacity = opacity;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = scale * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexture;
                varying float vOpacity;
                void main() {
                    vec4 texColor = texture2D(uTexture, gl_PointCoord);
                    gl_FragColor = vec4(0.85, 0.8, 0.75, texColor.a * vOpacity); 
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending
        });

        this.particleMesh = new THREE.Points(this.particleGeo, shaderMaterial);
        this.particleMesh.frustumCulled = false; 
        this.scene.add(this.particleMesh);
    }

    emitDust(count, centerPos, spread = 0.5) {
        let emitted = 0;
        const positions = this.particleGeo.attributes.position.array;
        
        for (let i = 0; i < this.particleCount; i++) {
            if (this.particlesData[i].life <= 0) {
                const p = this.particlesData[i];
                p.maxLife = 0.3 + Math.random() * 0.3; 
                p.life = p.maxLife;

                p.vel.set((Math.random() - 0.5) * 2.0, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 2.0);

                positions[i*3] = centerPos.x + (Math.random() - 0.5) * spread;
                positions[i*3+1] = centerPos.y + 0.1;
                positions[i*3+2] = centerPos.z + (Math.random() - 0.5) * spread;

                emitted++;
                if (emitted >= count) break;
            }
        }
    }

    updateDustParticles(delta) {
        const positions = this.particleGeo.attributes.position.array;
        const opacities = this.particleGeo.attributes.opacity.array;
        const scales = this.particleGeo.attributes.scale.array;
        let needsUpdate = false;

        for (let i = 0; i < this.particleCount; i++) {
            const p = this.particlesData[i];
            if (p.life > 0) {
                p.life -= delta;
                if (p.life <= 0) {
                    opacities[i] = 0; 
                } else {
                    positions[i*3] += p.vel.x * delta;
                    positions[i*3+1] += p.vel.y * delta;
                    positions[i*3+2] += p.vel.z * delta;

                    const lifeRatio = p.life / p.maxLife; 
                    opacities[i] = lifeRatio * 0.4; 
                    scales[i] = 5.0 + (1.0 - lifeRatio) * 15.0; 
                }
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.particleGeo.attributes.position.needsUpdate = true;
            this.particleGeo.attributes.opacity.needsUpdate = true;
            this.particleGeo.attributes.scale.needsUpdate = true;
        }
    }

    loadGenshinCharacter(path) {
        const fileName = path.split('/').pop();
        const loader = new GLTFLoader(this.loadingManager);
        loader.load(
            path,
            (gltf) => {
                const characterMesh = gltf.scene;
                this.applyMaterialFixes(characterMesh, fileName);
                
                characterMesh.scale.set(1.8, 1.8, 1.8);
                this.model.add(characterMesh);

                this.animations = gltf.animations;

                if (this.animations && this.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(characterMesh);
                    
                    this.mixer.addEventListener('finished', () => {
                        this.currentAnimState = null;
                    });

                    this.setupAnimationSelects();
                }
            },
            undefined,
            (error) => {
                console.error(`Gagal memuat model ${fileName}:`, error);
            }
        );
    }

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

                        if (isFoliage || mat.transparent || mat.alphaMap) mat.side = THREE.DoubleSide;
                        else mat.side = THREE.FrontSide;

                        if (mat.transparent || mat.alphaMap || (mat.map && mat.map.format === THREE.RGBAFormat)) {
                            mat.transparent = false; mat.alphaTest = 0.5; mat.depthWrite = true;
                        }
                        if (mat.opacity === 0) mat.opacity = 1;

                        if (isFoliage) {
                            child.geometry.computeBoundingBox();
                            const bbox = child.geometry.boundingBox;
                            const localMinY = bbox.min.y;
                            const localHeight = (bbox.max.y - bbox.min.y) || 0.001;

                            mat.onBeforeCompile = (shader) => {
                                shader.uniforms.windTime = windUniforms.time;
                                if (isPushable) shader.uniforms.playerPos = interactionUniforms.playerPos;
                                
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
                                    float normY = clamp((position.y - localMinY) / localHeight, 0.0, 1.0);
                                    vec4 worldPosWind = modelMatrix * vec4(position, 1.0);
                                    ${isTree ? `float swayMultiplier = pow(normY, 2.0) * 0.15;` : `float swayMultiplier = normY * 0.15;`}
                                    float windX = sin(windTime * 2.0 + worldPosWind.x * 0.5 + worldPosWind.z * 0.5) * swayMultiplier;
                                    float windZ = cos(windTime * 1.5 + worldPosWind.x * 0.5 + worldPosWind.z * 0.5) * swayMultiplier;
                                    
                                    ${isPushable ? `
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

    loadCustomCharacter(gltf, fileName = '') {
        while (this.model.children.length > 0) this.model.remove(this.model.children[0]);
        const characterMesh = gltf.scene;
        this.applyMaterialFixes(characterMesh, fileName);
        this.model.add(characterMesh);

        this.animations = gltf.animations;

        if (this.animations && this.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(characterMesh);
            this.mixer.addEventListener('finished', () => {
                this.currentAnimState = null;
            });
            this.setupAnimationSelects();
        } else {
            this.mixer = null;
        }
    }

    setupAnimationSelects() {
        const menu = document.getElementById('anim-config-menu');
        if (menu) menu.style.display = 'flex';

        const selects = {
            idle: document.getElementById('sel-idle'), walk: document.getElementById('sel-walk'),
            run: document.getElementById('sel-run'), jump: document.getElementById('sel-jump')
        };

        for (let key in selects) {
            if (selects[key]) selects[key].innerHTML = '<option value="">-- Pilih --</option>';
        }
        for (let key in this.animMap) {
            this.animMap[key] = null;
        }

        if (!this.animations || this.animations.length === 0) return;

        const isForbidden = (name) => {
            const forbidden = ['die', 'death', 'fall', 'air'];
            return forbidden.some(fw => name.includes(fw));
        };

        const exactMap = {
            idle: 'idle', walk: 'walk', run: 'run', jump: 'jump', sneak: 'sneak',
            roll: 'roll', climbDown: 'climbdown', wallClimb: 'wallclimb', crawl: 'crawl',
            swim: 'swim', swimIdle: 'swimidle', fly: 'fly', slide: 'slide', hit: 'hit',
            pickup: 'pickup', plant: 'plant', gather: 'gather', drink: 'drink',
            enterCar: 'entercar', exitCar: 'exitcar', drive: 'drive'
        };

        const keywords = {
            idle: ['idle', 'stand', 'wait', 'pose', 'still', 'happy'],
            walk: ['walk', 'strid', 'step', 'march'],
            run: ['run', 'sprint', 'jog', 'dash', 'fast'],
            jump: ['jump', 'leap'],
            sneak: ['sneak', 'crouch', 'stealth'],
            roll: ['roll'],
            climbDown: ['climb down', 'descend', 'climbdown'],
            wallClimb: ['wall climb', 'climbing', 'wallclimb'],
            crawl: ['crawl'],
            swim: ['swim'],
            swimIdle: ['tread', 'treading', 'swimidle'],
            fly: ['fly'],
            slide: ['slide'],
            hit: ['hit', 'damage', 'impact'],
            pickup: ['pick', 'picking', 'pickup'],
            plant: ['plant'],
            gather: ['gather'],
            drink: ['drink'],
            enterCar: ['enter car', 'entering', 'entercar'],
            exitCar: ['exit car', 'exiting', 'exitcar'],
            drive: ['drive', 'driving']
        };

        this.animations.forEach((clip, index) => {
            const name = clip.name.toLowerCase();
            
            for (let key in selects) {
                if (selects[key]) {
                    let opt = document.createElement('option'); 
                    opt.value = index; 
                    opt.text = clip.name;
                    selects[key].appendChild(opt);
                }
            }

            if (!isForbidden(name)) {
                for (let animKey in this.animMap) {
                    if (!this.animMap[animKey]) {
                        if (exactMap[animKey] && name === exactMap[animKey]) {
                            this.animMap[animKey] = clip;
                            if (selects[animKey]) selects[animKey].value = index;
                        } 
                        else if (keywords[animKey] && keywords[animKey].some(kw => name.includes(kw))) {
                            this.animMap[animKey] = clip;
                            if (selects[animKey]) selects[animKey].value = index;
                        }
                    }
                }
            }
        });

        const validClips = this.animations.filter(c => !isForbidden(c.name.toLowerCase()));
        const fallbackSource = validClips.length > 0 ? validClips : this.animations;

        if (!this.animMap.idle) this.animMap.idle = fallbackSource[0];
        if (!this.animMap.walk) this.animMap.walk = fallbackSource[1] || fallbackSource[0];
        if (!this.animMap.run) this.animMap.run = fallbackSource[2] || this.animMap.walk;
        if (!this.animMap.jump) this.animMap.jump = fallbackSource[3] || this.animMap.idle;
        
        if (!this.animMap.sneak) this.animMap.sneak = this.animMap.walk;
        if (!this.animMap.roll) this.animMap.roll = this.animMap.jump;

        for (let key in selects) {
            if (selects[key] && this.animMap[key]) {
                const idx = this.animations.indexOf(this.animMap[key]);
                if (idx !== -1) selects[key].value = idx;
            }
            if (selects[key]) {
                selects[key].onchange = (e) => {
                    this.animMap[key] = e.target.value !== "" ? this.animations[e.target.value] : null;
                    this.currentAnimState = null;
                    this.playAnimation(key);
                };
            }
        }
        
        this.currentAnimState = null;
        this.playAnimation('idle');
    }

    playAnimation(state, customFadeDuration = null) {
        if (!this.mixer) return;

        if (this.currentAnimState === state) {
            return;
        }

        const clip = this.animMap[state];
        if (!clip) return;

        const prevAction = this.currentAction;
        const nextAction = this.mixer.clipAction(clip);
        this.currentAnimState = state;

        const oneShotStates = ['jump', 'roll', 'slide', 'wallClimb', 'hit', 'pickup', 'plant', 'gather', 'drink', 'enterCar', 'exitCar'];

        nextAction.reset();
        nextAction.enabled = true;

        if (oneShotStates.includes(state)) {
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = true; 
        } else {
            nextAction.setLoop(THREE.LoopRepeat);
            nextAction.clampWhenFinished = false;
        }

        // Fast-Forward instan melewati fase wind-up/jongkok pada klip animasi Jump
        if (state === 'jump' && clip.duration > 1.2) {
            nextAction.time = clip.duration * 0.28;
        }

        // Durasi crossfade pemulusan transisi aksi
        const fadeDuration = customFadeDuration !== null ? customFadeDuration : 0.15;

        if (prevAction && prevAction !== nextAction) {
            prevAction.fadeOut(fadeDuration);
            nextAction.fadeIn(fadeDuration).play();
        } else {
            nextAction.play();
        }
        this.currentAction = nextAction;
    }

    updatePhysics(delta, inputState, cameraAngle, world) {
        if (!this.model) return;

        if (this.mixer) this.mixer.update(delta);
        interactionUniforms.playerPos.value.copy(this.model.position);

        let allCollisionMeshes = [...world.baseObstacleMeshes];
        world.placedAssetsList.forEach(a => {
            const name = (a.mesh.name || '').toLowerCase();
            const isPassable = name.includes('grass') || name.includes('bush') || name.includes('flower') || name.includes('clover') || name.includes('plant');
            if (!isPassable) allCollisionMeshes.push(a.mesh);
        });
        
        let allTargets = [world.floorMesh, ...allCollisionMeshes];

        if (!this.isReady) {
            if (!world.isMapLoaded) {
                this.model.position.set(372, 3.0, -115);
                this.yVelocity = 0;
                return;
            }

            const spawnRay = new THREE.Raycaster(
                new THREE.Vector3(372, 500, -115), new THREE.Vector3(0, -1, 0), 0, 1000
            );
            const hits = spawnRay.intersectObjects(allTargets, true);

            if (hits.length > 0) {
                this.model.position.set(372, hits[0].point.y + 0.05, -115);
                this.yVelocity = 0;
                this.isGrounded = true;
                this.isReady = true;
                this.lastGroundedY = this.model.position.y;
            } else {
                this.model.position.set(372, 3.0, -115);
            }
            return;
        }

        if (this.model.position.y > 100 || this.model.position.y < -50) {
            const rescueRay = new THREE.Raycaster(
                new THREE.Vector3(this.model.position.x, 500, this.model.position.z), new THREE.Vector3(0, -1, 0), 0, 1000
            );
            const rescueHits = rescueRay.intersectObjects(allTargets, true);
            if (rescueHits.length > 0) {
                this.model.position.y = rescueHits[0].point.y + 0.5;
                this.yVelocity = 0;
            } else {
                this.model.position.set(372, 3.0, -115);
                this.isReady = false;
            }
            return;
        }

        const prevYVelocity = this.yVelocity;
        this.wasGroundedPrev = this.isGrounded;

        const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion).normalize();

        // =========================================================================
        // LOGIKA SMART VAULT BERTINGKAT: 2.0M DARI TANAH vs 2.5M DI UDARA
        // =========================================================================
        if (inputState.keys.space && !this.wasSpacePressed && !this.isRolling && !this.isSliding && !this.isClimbing) {
            let vaultFound = false;

            // 1. Pemindaian bertingkat dari depan untuk mendeteksi tinggi fisik objek (Pagar Tipis / Tembok)
            const scanOffsets = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2];
            let highestHitY = -Infinity;
            let hitDistance = 1.6;
            let obstacleHit = false;

            for (let offset of scanOffsets) {
                const probeRay = new THREE.Raycaster(
                    new THREE.Vector3(this.model.position.x, this.lastGroundedY + offset, this.model.position.z),
                    forwardDir, 0, 1.6
                );
                const hits = probeRay.intersectObjects(allTargets, true);
                if (hits.length > 0) {
                    obstacleHit = true;
                    highestHitY = Math.max(highestHitY, this.lastGroundedY + offset);
                    hitDistance = hits[0].distance;
                }
            }

            if (obstacleHit) {
                // 2. Cek apakah di atas objek ada permukaan pijakan tebal (Tembok/Atap)
                const checkPos = new THREE.Vector3().copy(this.model.position).addScaledVector(forwardDir, hitDistance + 0.3);
                checkPos.y = this.lastGroundedY + 5.0;

                const downRay = new THREE.Raycaster(checkPos, new THREE.Vector3(0, -1, 0), 0, 6.0);
                const downHits = downRay.intersectObjects(allTargets, true);

                let trueTopY = highestHitY;
                let isWalkableRoof = false;

                if (downHits.length > 0 && downHits[0].point.y >= highestHitY - 0.4) {
                    trueTopY = downHits[0].point.y;
                    isWalkableRoof = true;
                }

                // Hitung tinggi total objek dari permukaan lantai pijakan
                const totalHeightFromGround = trueTopY - this.lastGroundedY;

                // ATURAN 1: Ketinggian <= 2.0 Meter -> Langsung panjat dari tanah (1x Spasi)
                if (this.isGrounded && totalHeightFromGround >= 0.4 && totalHeightFromGround <= 2.05) {
                    this.isClimbing = true;
                    this.climbDuration = 0.75;
                    this.climbTimer = this.climbDuration;
                    this.yVelocity = 0;
                    this.stamina -= 12;

                    this.climbStartPos = this.model.position.clone();
                    this.climbTargetPos = this.model.position.clone();

                    if (isWalkableRoof) {
                        // Naik mendarat di atas tembok tebal
                        this.climbTargetPos.y = trueTopY + 0.05;
                        this.climbTargetPos.addScaledVector(forwardDir, 0.7);
                    } else {
                        // Melompati pagar tipis ke tanah seberang (Vault Over)
                        this.climbTargetPos.addScaledVector(forwardDir, 1.4);
                    }
                    vaultFound = true;
                }
                // ATURAN 2: Ketinggian 2.0m s/d 2.5 Meter -> HARUS LOMPAT DULU di udara baru bisa memanjat
                else if (!this.isGrounded && totalHeightFromGround > 1.8 && totalHeightFromGround <= 2.6) {
                    this.isClimbing = true;
                    this.climbDuration = 0.9;
                    this.climbTimer = this.climbDuration;
                    this.yVelocity = 0;
                    this.stamina -= 18;

                    this.climbStartPos = this.model.position.clone();
                    this.climbTargetPos = this.model.position.clone();
                    this.climbTargetPos.y = trueTopY + 0.05;
                    this.climbTargetPos.addScaledVector(forwardDir, 0.7);
                    vaultFound = true;
                }
            }

            // Eksekusi lompatan normal jika tidak memenuhi syarat panjat
            if (!vaultFound && this.isGrounded) {
                this.yVelocity = this.jumpForce;
                this.isGrounded = false;
                this.playAnimation('jump', 0.05); // Respon instan
            }
        }
        this.wasSpacePressed = inputState.keys.space;

        // Eksekusi pergerakan translasi manjat/vaulting
        if (this.isClimbing) {
            this.currentVelocity.set(0, 0, 0);
            this.climbTimer -= delta;
            
            const progress = Math.min(Math.max(1.0 - (this.climbTimer / this.climbDuration), 0.0), 1.0); 
            const yProgress = Math.sin(progress * (Math.PI / 2)); 
            const xzProgress = Math.pow(progress, 1.8); 
            
            this.model.position.y = THREE.MathUtils.lerp(this.climbStartPos.y, this.climbTargetPos.y, yProgress);
            this.model.position.x = THREE.MathUtils.lerp(this.climbStartPos.x, this.climbTargetPos.x, xzProgress);
            this.model.position.z = THREE.MathUtils.lerp(this.climbStartPos.z, this.climbTargetPos.z, xzProgress);

            if (this.climbTimer <= 0) {
                this.isClimbing = false;
                this.model.position.copy(this.climbTargetPos); 
                this.currentAnimState = null;
            }
        }

        if (!this.isClimbing) {
            this.yVelocity += this.gravity * delta;
        } else {
            this.yVelocity = 0; 
        }

        if (this.yVelocity > 0 && !this.isClimbing) {
            const headRay = new THREE.Raycaster(
                new THREE.Vector3(this.model.position.x, this.model.position.y + 1.6, this.model.position.z),
                new THREE.Vector3(0, 1, 0), 0, 0.7 + Math.abs(this.yVelocity * delta)
            );
            const headHits = headRay.intersectObjects(allTargets, true);
            if (headHits.length > 0) this.yVelocity = -2.0;
        }

        const rayOffset = this.isGrounded ? 1.8 : 1.5;
        const rayLength = this.isGrounded ? 2.2 : 20.0;

        const downRay = new THREE.Raycaster(
            new THREE.Vector3(this.model.position.x, this.model.position.y + rayOffset, this.model.position.z),
            new THREE.Vector3(0, -1, 0), 0, rayLength
        );
        const groundIntersects = downRay.intersectObjects(allTargets, true);

        let surfaceHeight = -Infinity;
        let isTooSteep = false;
        let slopeNormal = new THREE.Vector3(0, 1, 0);
        let currentSurfaceType = 'street'; 

        for (let i = 0; i < groundIntersects.length; i++) {
            const hit = groundIntersects[i];
            if (hit.point.y <= this.model.position.y + 1.2) {
                surfaceHeight = hit.point.y;

                const meshHitName = (hit.object.name || '').toLowerCase();
                const matHitName = hit.object.material ? (hit.object.material.name || '').toLowerCase() : '';
                const combinedHitName = meshHitName + ' ' + matHitName;

                if (combinedHitName.includes('grass') || combinedHitName.includes('dirt') || combinedHitName.includes('ground') || combinedHitName.includes('terrain') || combinedHitName.includes('sand')) {
                    currentSurfaceType = 'grass';
                } else if (combinedHitName.includes('wood') || combinedHitName.includes('plank') || combinedHitName.includes('floor') || combinedHitName.includes('house') || combinedHitName.includes('bark')) {
                    currentSurfaceType = 'wood';
                }

                if (hit.face) {
                    const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                    slopeNormal.copy(worldNormal);
                    const angle = worldNormal.angleTo(new THREE.Vector3(0, 1, 0));
                    if (angle > 0.87) isTooSteep = true;
                }
                break;
            }
        }

        let nextY = this.model.position.y + this.yVelocity * delta;
        const snapThreshold = this.isGrounded ? 0.6 : 0.05;

        if (surfaceHeight !== -Infinity && (nextY <= surfaceHeight || (this.isGrounded && this.model.position.y - surfaceHeight <= snapThreshold)) && !this.isClimbing) {
            if (isTooSteep && !this.isGrounded) {
                this.yVelocity = Math.min(this.yVelocity, -8.0);
                this.model.position.y = nextY;
                this.currentVelocity.x += slopeNormal.x * 6.0 * delta;
                this.currentVelocity.z += slopeNormal.z * 6.0 * delta;
            } else {
                this.yVelocity = 0;
                const targetY = surfaceHeight;
                const smoothFactor = 1.0 - Math.exp(-25.0 * delta);
                this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, targetY, smoothFactor);
                this.isGrounded = true;
                this.lastGroundedY = this.model.position.y;
            }
        } else if (!this.isClimbing) {
            this.isGrounded = false;
            this.model.position.y = nextY;
        }

        // =========================================================
        // LOGIKA KONTROL HORIZONTAL & SLIDE
        // =========================================================
        let moveX = inputState.joyMoveX;
        let moveZ = inputState.joyMoveZ;

        if (inputState.keys.w) moveZ = -1;
        if (inputState.keys.s) moveZ = 1;
        if (inputState.keys.a) moveX = -1;
        if (inputState.keys.d) moveX = 1;

        let isSneaking = inputState.keys.c;
        let isSprintKey = (inputState.keys.shift || inputState.isJoySprinting);
        let isSprinting = isSprintKey && !isSneaking;

        if (inputState.isAutoRun) { moveZ = -1; isSprinting = true; }
        
        let hasInput = (moveX !== 0 || moveZ !== 0);
        let horizontalSpeed = Math.sqrt(this.currentVelocity.x * this.currentVelocity.x + this.currentVelocity.z * this.currentVelocity.z);

        // TRIGGER SLIDE: Lari kencang lalu menekan tombol Sneak (C)
        if (isSprintKey && inputState.keys.c && this.isGrounded && !this.isSliding && !this.isRolling && !this.isClimbing && this.stamina >= 10 && horizontalSpeed > 3.0) {
            this.isSliding = true;
            this.slideTimer = 0.9; 
            this.stamina -= 10;
        }

        // TRIGGER ROLL: Menekan tombol Roll (Alt)
        if (inputState.keys.alt && this.isGrounded && !this.isRolling && !this.isSliding && !this.isClimbing && this.stamina >= 15) {
            this.isRolling = true;
            this.rollTimer = 0.85; 
            this.stamina -= 15; 
        }

        if ((this.isRolling || this.isSliding) && !hasInput) {
            moveZ = -1;
            hasInput = true;
        }

        if (this.isRolling) {
            this.rollTimer -= delta;
            if (this.rollTimer <= 0) {
                this.isRolling = false;
                this.currentAnimState = null; 
            }
        }

        if (this.isSliding) {
            this.slideTimer -= delta;
            isSprinting = false; 
            if (this.slideTimer <= 0) {
                this.isSliding = false;
                this.currentAnimState = null; 
            }
        }

        if (isSprinting && hasInput && this.isGrounded && !this.isRolling && !this.isSliding && !this.isClimbing) {
            this.stamina -= delta * 25; 
            if (this.stamina <= 0) {
                this.stamina = 0;
                isSprinting = false; 
            }
        } else {
            this.stamina += delta * 15; 
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        }

        const staminaFill = document.getElementById('stamina-fill');
        const staminaContainer = document.getElementById('stamina-container');
        if (staminaFill && staminaContainer) {
            staminaFill.style.width = `${(this.stamina / this.maxStamina) * 100}%`;
            if (this.stamina < 99) {
                staminaContainer.style.opacity = '1';
            } else {
                staminaContainer.style.opacity = '0';
            }
        }

        // Update kecepatan horizontal sesuai state aktif
        let currentSpeed = this.moveSpeed;
        
        if (this.isSliding) {
            const burstRatio = this.slideTimer / 0.9; 
            currentSpeed = this.moveSpeed * (1.5 + (burstRatio * 2.5)); 
        } else if (this.isRolling) {
            currentSpeed = this.moveSpeed * 2.0; 
        } else if (isSprinting) {
            currentSpeed = this.moveSpeed * this.sprintMultiplier;
        } else if (isSneaking) {
            currentSpeed = this.moveSpeed * 0.42; 
        }

        const targetVelocity = new THREE.Vector3(0, 0, 0);

        if (hasInput && !this.isClimbing) {
            let length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            moveX /= length; moveZ /= length;

            let s = Math.sin(cameraAngle);
            let c = Math.cos(cameraAngle);

            targetVelocity.x = (moveX * c + moveZ * s) * currentSpeed;
            targetVelocity.z = (moveX * -s + moveZ * c) * currentSpeed;
        }

        if (!this.isClimbing) {
            const lerpFactor = 1.0 - Math.exp(-9.0 * delta);
            this.currentVelocity.lerp(targetVelocity, lerpFactor);

            const maxStepHeight = 0.7; 
            const moveDistX = 0.35 + Math.abs(this.currentVelocity.x * delta);
            const moveDistZ = 0.35 + Math.abs(this.currentVelocity.z * delta);

            let finalMoveX = this.currentVelocity.x * delta;
            if (Math.abs(finalMoveX) > 0.0001) {
                let dirX = new THREE.Vector3(Math.sign(finalMoveX), 0, 0);
                let perpX = new THREE.Vector3(0, 0, 1);
                let offsets = [0, -0.22, 0.22];
                let footHit = false, stepHit = false, waistHit = false;

                for (let off of offsets) {
                    let startPos = new THREE.Vector3().copy(this.model.position).addScaledVector(perpX, off);
                    if (new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + 0.1, startPos.z), dirX, 0, moveDistX).intersectObjects(allTargets, true).length > 0) footHit = true;
                    if (new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + maxStepHeight, startPos.z), dirX, 0, moveDistX).intersectObjects(allTargets, true).length > 0) stepHit = true;
                    if (new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + 1.3, startPos.z), dirX, 0, moveDistX).intersectObjects(allTargets, true).length > 0) waistHit = true;
                }

                if (footHit && !stepHit && !waistHit) {
                    const stepCheckRay = new THREE.Raycaster(
                        new THREE.Vector3(this.model.position.x + dirX.x * moveDistX, this.model.position.y + maxStepHeight + 0.8, this.model.position.z),
                        new THREE.Vector3(0, -1, 0), 0, maxStepHeight + 0.9
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
                    this.currentVelocity.x = 0;
                }
            }

            let finalMoveZ = this.currentVelocity.z * delta;
            if (Math.abs(finalMoveZ) > 0.0001) {
                let dirZ = new THREE.Vector3(0, 0, Math.sign(finalMoveZ));
                let perpZ = new THREE.Vector3(1, 0, 0);
                let offsets = [0, -0.22, 0.22];
                let footHit = false, stepHit = false, waistHit = false;

                for (let off of offsets) {
                    let startPos = new THREE.Vector3().copy(this.model.position).addScaledVector(perpZ, off);
                    if (new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + 0.1, startPos.z), dirZ, 0, moveDistZ).intersectObjects(allTargets, true).length > 0) footHit = true;
                    if (new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + maxStepHeight, startPos.z), dirZ, 0, moveDistZ).intersectObjects(allTargets, true).length > 0) stepHit = true;
                    if (new THREE.Raycaster(new THREE.Vector3(startPos.x, startPos.y + 1.3, startPos.z), dirZ, 0, moveDistZ).intersectObjects(allTargets, true).length > 0) waistHit = true;
                }

                if (footHit && !stepHit && !waistHit) {
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
                    this.currentVelocity.z = 0;
                }
            }
        }

        horizontalSpeed = Math.sqrt(this.currentVelocity.x * this.currentVelocity.x + this.currentVelocity.z * this.currentVelocity.z);

        if (hasInput && horizontalSpeed > 0.1 && !this.isClimbing) {
            let targetAngle = Math.atan2(this.currentVelocity.x, this.currentVelocity.z);
            let targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
            const rotateSpeed = 1.0 - Math.exp(-6.5 * delta);
            this.model.quaternion.slerp(targetQuaternion, rotateSpeed);
        }

        // =========================================================
        // MANAJEMEN ANIMASI SINKRON & VFX PARTIKEL
        // =========================================================
        
        // Deteksi pendaratan keras (Landing VFX)
        if (this.isGrounded && !this.wasGroundedPrev && prevYVelocity < -10.0 && currentSurfaceType !== 'wood') {
            this.emitDust(15, this.model.position, 0.8);
        }

        let targetAnimState = 'idle';

        if (this.isClimbing) {
            targetAnimState = 'wallClimb';
            this.footstepTimer = 0;
            this.dustTimer = 0;
        } else if (!this.isGrounded) {
            targetAnimState = 'jump';
            this.footstepTimer = 0; 
            this.dustTimer = 0;
        } else if (this.isSliding) {
            targetAnimState = 'slide';
            this.footstepTimer = 0;
            this.dustTimer -= delta;
            if (this.dustTimer <= 0) {
                this.emitDust(4, this.model.position, 0.6);
                this.dustTimer = 0.05; 
            }
        } else if (this.isRolling) {
            targetAnimState = 'roll';
            this.footstepTimer = 0;
            this.dustTimer -= delta;
            if (this.dustTimer <= 0) {
                this.emitDust(3, this.model.position, 0.4);
                this.dustTimer = 0.08; 
            }
        } else if (hasInput || horizontalSpeed > 0.4) {
            if (isSprinting) {
                targetAnimState = 'run';
            } else if (isSneaking) {
                targetAnimState = 'sneak';
            } else {
                targetAnimState = 'walk';
            }

            this.footstepTimer -= delta;
            if (this.footstepTimer <= 0) {
                if (this.audio && !isSneaking) {
                    this.audio.playFootstep(isSprinting ? 'run' : 'walk', currentSurfaceType);
                }
                this.footstepTimer = isSprinting ? 0.32 : (isSneaking ? 0.8 : 0.52); 
            }

            if (isSprinting && currentSurfaceType !== 'wood') {
                this.dustTimer -= delta;
                if (this.dustTimer <= 0) {
                    this.emitDust(2, this.model.position, 0.3);
                    this.dustTimer = 0.1; 
                }
            } else {
                this.dustTimer = 0;
            }
        } else {
            targetAnimState = 'idle';
            this.footstepTimer = 0; 
            this.dustTimer = 0;
        }

        // Sinkronisasi kecepatan animasi secara proporsional dan natural
        if (this.currentAction) {
            if (targetAnimState === 'walk') {
                this.currentAction.timeScale = (horizontalSpeed / 4.5) * 0.85; 
            } else if (targetAnimState === 'run') {
                this.currentAction.timeScale = (horizontalSpeed / 13.5) * 0.95; 
            } else if (targetAnimState === 'sneak') {
                this.currentAction.timeScale = (horizontalSpeed / 1.8) * 0.8; 
            } else if (targetAnimState === 'jump') {
                this.currentAction.timeScale = 1.05; 
            } else if (targetAnimState === 'roll' || targetAnimState === 'slide') {
                this.currentAction.timeScale = 1.25; 
            } else {
                this.currentAction.timeScale = 1.0;
            }
        }

        // Transisi landing instan saat menyentuh lantai (fade cepat 0.08 detik)
        const isLandingTransition = this.isGrounded && !this.wasGroundedPrev;
        this.playAnimation(targetAnimState, isLandingTransition ? 0.08 : 0.15);
        
        this.updateDustParticles(delta);
    }
}