import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, BlendFunction } from 'postprocessing';

/**
 * Pengelola Mesin Utama Rendering 3D, Kamera, Pencahayaan, Postprocessing, dan Optimalisasi Performa
 */
export class GameEngine {
    constructor() {
        this.scene = new THREE.Scene();
        
        // Deteksi perangkat seluler (HP / Tablet)
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Menggunakan Linear Fog dengan warna langit yang sedikit lebih gelap agar tidak silau
        this.scene.fog = new THREE.Fog(0x75b9e6, 30, 100);

        // Far clipping plane awal (akan diatur dinamis oleh setRenderDistance)
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        // WebGL Renderer dengan pengaturan performa adaptif & antialiasing dinonaktifkan
        this.renderer = new THREE.WebGLRenderer({ 
            powerPreference: "high-performance",
            antialias: false 
        });

        // Tingkat resolusi render default
        this.currentResolutionLevel = 'high';
        this.updatePixelRatio();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        // Gunakan tipe bayangan yang lebih ringan di perangkat mobile
        this.renderer.shadowMap.type = this.isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
        
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // DITURUNKAN: Exposure layar dikurangi agar langit dan jalan tidak over-exposed (silau)
        this.renderer.toneMappingExposure = 0.55; 
        
        document.body.appendChild(this.renderer.domElement);

        this.currentRenderDistLevel = this.isMobile ? 100 : 1000;
        this.currentMaxDistance = this.isMobile ? 100 : 1000;

        this.initLighting();
        this.initPostProcessing(); 
        this.initResizeListener();
        
        // Terapkan preset jarak pandang awal berdasarkan jenis perangkat
        this.setRenderDistance(this.currentMaxDistance);
    }

    /**
     * Memperbarui tingkat kualitas resolusi render secara dinamis
     * @param {string} level - Tingkat kualitas ('low', 'med', 'high')
     */
    setResolutionQuality(level) {
        if (level) this.currentResolutionLevel = level;
        this.updatePixelRatio();
    }

    /**
     * Menghitung dan menerapkan Pixel Ratio presisi ke renderer
     */
    updatePixelRatio() {
        const dpr = window.devicePixelRatio || 1;
        let targetRatio = 1.0;

        if (this.currentResolutionLevel === 'low') {
            targetRatio = 0.75;
        } else if (this.currentResolutionLevel === 'med') {
            targetRatio = 1.25;
        } else if (this.currentResolutionLevel === 'high') {
            // Menggunakan resolusi native layar (maksimal 2.0x agar gambar tajam dan tidak pecah)
            targetRatio = Math.min(dpr, 2.0);
        }

        this.renderer.setPixelRatio(targetRatio);
    }

    /**
     * Inisialisasi sistem pencahayaan dan kalkulasi bayangan adaptif
     */
    initLighting() {
        // DITURUNKAN: Intensitas Hemisphere Light dikurangi sedikit agar area bayangan lebih memiliki kedalaman
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
        this.hemiLight.position.set(0, 500, 0);
        this.scene.add(this.hemiLight);

        // DITURUNKAN: Intensitas Directional Light (Matahari) diturunkan secara signifikan dari 2.2 menjadi 1.4
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
        this.dirLight.position.set(200, 600, 200);
        this.dirLight.castShadow = true;

        // RESOLUSI BAYANGAN ADAPTIF
        const shadowSize = this.isMobile ? 1024 : 2048;
        this.dirLight.shadow.mapSize.width = shadowSize;
        this.dirLight.shadow.mapSize.height = shadowSize;
        
        // Memperketat near/far kamera bayangan
        this.dirLight.shadow.camera.near = 100;
        this.dirLight.shadow.camera.far = 1200;
        
        // Jangkauan kamera bayangan disesuaikan dengan jenis perangkat
        const shadowBounds = this.isMobile ? 100 : 250;
        this.dirLight.shadow.camera.left = -shadowBounds;
        this.dirLight.shadow.camera.right = shadowBounds;
        this.dirLight.shadow.camera.top = shadowBounds;
        this.dirLight.shadow.camera.bottom = -shadowBounds;
        
        // PERBAIKAN SHADOW ACNE & GARIS-GARIS BERGELOMBANG DI TANAH
        this.dirLight.shadow.bias = -0.0003;
        this.dirLight.shadow.normalBias = 0.08;
        
        this.scene.add(this.dirLight);
    }

    /**
     * Inisialisasi Postprocessing Pipeline untuk Efek Sinematik (Bloom, Vignette)
     */
    initPostProcessing() {
        this.composer = new EffectComposer(this.renderer, {
            frameBufferType: THREE.HalfFloatType 
        });

        // 1. Pass Pertama: Render Scene Utama
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // 2. Efek Bloom (Pendaran Cahaya Realistis) - DIKALIBRASI ULANG
        const bloomEffect = new BloomEffect({
            blendFunction: BlendFunction.SCREEN,
            mipmapBlur: true, 
            luminanceThreshold: 0.95, // DINAIKKAN: Hanya objek yang benar-benar memancarkan cahaya yang akan berpendar, langit aman
            luminanceSmoothing: 0.05,
            intensity: 0.3 // DITURUNKAN: Agar efek pendaran lebih halus dan tidak menyilaukan mata
        });

        // 3. Efek Vignette (Penggelapan di sudut layar untuk fokus sinematik)
        const vignetteEffect = new VignetteEffect({
            eskil: false,
            offset: 0.15,
            darkness: 0.45
        });

        // 4. Pass Terakhir: Terapkan semua efek ke layar
        const effectPass = new EffectPass(this.camera, bloomEffect, vignetteEffect);
        this.composer.addPass(effectPass);
    }

    /**
     * Pengatur Jarak Pandang Dinamis Presisi (Render Distance & Fog Clipper)
     * @param {number|string} val - Nilai jarak pandang kustom dalam meter (30m - 2000m)
     */
    setRenderDistance(val) {
        let targetFar = 100;
        if (typeof val === 'number' || !isNaN(Number(val))) {
            targetFar = Math.max(30, Number(val));
        } else {
            if (val === 'low') targetFar = 100;
            else if (val === 'med') targetFar = 250;
            else if (val === 'high') targetFar = 500;
            else if (val === 'ultra') targetFar = 1000;
        }

        this.currentMaxDistance = targetFar;

        this.camera.far = targetFar;
        this.camera.updateProjectionMatrix();

        // Update Linear Fog agar batas potongan objek tersamarkan mulus dengan langit
        if (this.scene.fog) {
            // DIMUNDURKAN: Jarak pandang bebas kabut diperlebar agar area depan pemain jernih
            this.scene.fog.near = Math.max(40, targetFar * 0.75);
            this.scene.fog.far = targetFar;
        }

        if (this.dirLight) {
            this.dirLight.shadow.camera.far = Math.min(targetFar, 1200);
            this.dirLight.shadow.camera.updateProjectionMatrix();
        }
    }

    /**
     * Optimalisasi Jarak Objek (Distance Culling)
     * @param {THREE.Vector3} playerPos - Posisi koordinat pemain saat ini
     * @param {Array} placedAssetsList - Daftar aset objek yang diletakkan di map
     */
    updateDistanceCulling(playerPos, placedAssetsList = []) {
        if (!playerPos) return;

        const maxDistSq = this.currentMaxDistance * this.currentMaxDistance;

        placedAssetsList.forEach(asset => {
            if (asset && asset.mesh) {
                const distSq = playerPos.distanceToSquared(asset.mesh.position);
                asset.mesh.visible = (distSq <= maxDistSq);
            }
        });
    }

    /**
     * Penanganan pengubahan ukuran jendela browser / orientasi HP
     */
    initResizeListener() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            if (this.composer) {
                this.composer.setSize(window.innerWidth, window.innerHeight);
            }
            this.updatePixelRatio();
        });
    }

    /**
     * Mengeksekusi rendering frame 3D melalui Composer Postprocessing
     * @param {number} delta - Selisih waktu antar frame
     */
    render(delta) {
        if (this.composer) {
            this.composer.render(delta);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}