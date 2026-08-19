import * as THREE from 'three';

/**
 * Advanced Object Pooling & Frustum Culling untuk StreetLamp
 * Menghilangkan lag (stutter) akibat shader recompilation dengan cara
 * menggunakan lampu daur ulang (Light Pool) yang diteleportasi.
 */

const MAX_VISIBLE_LIGHTS = 30; // Jumlah lampu fisik daur ulang yang tersedia
const MAX_ACTIVE_SHADOWS = 4;  // Lampu dengan bayangan aktif

class StreetLampCullingManager {
    constructor(sceneRoot, camera, checkIntervalFrames = 5) {
        this.camera = camera;
        this.checkInterval = checkIntervalFrames;
        this.frameCounter = 0;
        
        this.lampData = []; // Hanya menyimpan data koordinat (bukan objek lampu fisik)
        this.activeLights = []; // Lampu fisik sungguhan yang didaur ulang (Pool)

        // Sensor pandangan kamera
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();

        const lightsToRemove = [];

        // 1. Ekstrak data dari lampu asli (termasuk yang gak ada nomornya), lalu hapus
        sceneRoot.traverse((obj) => {
            if (obj.isLight && (obj.name.startsWith("Props_StreetLamp__") || obj.name.startsWith("StreetLamp_Light"))) {
                // Ambil koordinat dunia yang asli (udah dikali skala map)
                const worldPos = new THREE.Vector3();
                obj.getWorldPosition(worldPos);

                this.lampData.push({
                    position: worldPos,
                    color: obj.color.clone(),
                    cullRadiusSq: Math.pow(150.0, 2), // Jarak pandang 150 meter
                    intensity: 1500.0, // Intensitas cahaya realistis (1500 candelas)
                    distance: 60.0 // Jarak sorot cahaya
                });
                
                // Tandai lampu bawaan blender untuk dihapus
                lightsToRemove.push(obj);
            }
        });

        // Hapus lampu asli dari map agar tidak membebani Shader GPU
        lightsToRemove.forEach(light => light.removeFromParent());

        // 2. FIX KOORDINAT LUAR ANGKASA: Kita harus naruh lampu Pool di Scene utama
        // Cari parent paling mentok atas (Main Scene)
        let mainScene = sceneRoot;
        while (mainScene.parent) {
            mainScene = mainScene.parent;
        }

        // 3. Buat "Light Pool" (Lampu Daur Ulang)
        for (let i = 0; i < MAX_VISIBLE_LIGHTS; i++) {
            const poolLight = new THREE.PointLight(0xffffff, 0, 60, 2);
            
            // Hanya X lampu pertama di dalam pool yang diizinkan merender bayangan
            poolLight.castShadow = i < MAX_ACTIVE_SHADOWS;
            if (poolLight.castShadow) {
                poolLight.shadow.mapSize.width = 512;
                poolLight.shadow.mapSize.height = 512;
                poolLight.shadow.bias = -0.001;
            }

            // Sembunyikan jauh di bawah tanah dengan intensitas 0 saat pertama kali dibuat
            poolLight.position.set(0, -2000, 0);
            
            // Masukkan ke mainScene agar tidak terkena scale 2.0 dari map
            mainScene.add(poolLight); 
            this.activeLights.push(poolLight);
        }

        console.log(`[SmartLampCulling] ${this.lampData.length} tiang terdaftar. Menggunakan ${MAX_VISIBLE_LIGHTS} lampu daur ulang.`);
    }

    update() {
        this.frameCounter++;
        if (this.frameCounter % this.checkInterval !== 0) return;

        const camPos = this.camera.position;

        // 1. Perbarui Area Pandangan Kamera (Frustum)
        this.camera.updateMatrixWorld();
        this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
        this.projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        const candidates = [];

        // 2. Cari tiang lampu yang masuk radius DAN ada di jangkauan layar kamera
        for (const data of this.lampData) {
            const distSq = camPos.distanceToSquared(data.position);
            
            if (distSq <= data.cullRadiusSq) {
                // FIX SENSOR LAYAR: Jangan ngecek tiangnya doang, cek area cahayanya (Bounding Sphere)
                // Biar cahayanya tetep nyala kalau tiangnya ada di samping luar layar tapi cahayanya masuk layar
                const boundingSphere = new THREE.Sphere(data.position, data.distance);
                
                if (this.frustum.intersectsSphere(boundingSphere)) {
                    candidates.push({ ...data, distSq });
                }
            }
        }

        // 3. Urutkan tiang dari yang terdekat
        candidates.sort((a, b) => a.distSq - b.distSq);

        // 4. Teleportasi lampu daur ulang ke tiang yang terpilih
        for (let i = 0; i < this.activeLights.length; i++) {
            const poolLight = this.activeLights[i];
            const targetData = candidates[i];

            if (targetData) {
                // Teleportasi instan (Sangat halus, tanpa lag recompilation)
                poolLight.position.copy(targetData.position);
                poolLight.color.copy(targetData.color);
                
                // Efek memudar halus berdasarkan jarak
                const distRatio = Math.max(0, 1.0 - (targetData.distSq / targetData.cullRadiusSq));
                poolLight.intensity = targetData.intensity * Math.pow(distRatio, 0.5);
                
            } else {
                // Jika sisa lampu pool tidak terpakai, buang ke bawah tanah dan matikan cahayanya
                poolLight.position.set(0, -2000, 0);
                poolLight.intensity = 0;
            }
        }
    }
}

export { StreetLampCullingManager, MAX_VISIBLE_LIGHTS, MAX_ACTIVE_SHADOWS };