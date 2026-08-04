import * as THREE from 'three';

/**
 * Pengelola Mesin Utama Rendering 3D, Kamera, Pencahayaan, dan Optimalisasi Performa Perangkat
 */
export class GameEngine {
    constructor() {
        this.scene = new THREE.Scene();
        
        // Deteksi perangkat seluler (HP / Tablet)
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Menggunakan Linear Fog agar objek di batas jarak pandang memudar mulus dengan warna langit
        this.scene.fog = new THREE.Fog(0x87CEEB, 30, 100);

        // Far clipping plane awal (akan diatur dinamis oleh setRenderDistance)
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        // WebGL Renderer dengan pengaturan performa adaptif & antialiasing
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: "high-performance" 
        });

        // Tingkat resolusi render default (Default: High / Tinggi)
        this.currentResolutionLevel = 'high';
        this.updatePixelRatio();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        // Gunakan tipe bayangan yang lebih ringan di perangkat mobile
        this.renderer.shadowMap.type = this.isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
        
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8;
        
        document.body.appendChild(this.renderer.domElement);

        this.currentRenderDistLevel = this.isMobile ? 100 : 1000;
        this.currentMaxDistance = this.isMobile ? 100 : 1000;

        this.initLighting();
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
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
        this.hemiLight.position.set(0, 500, 0);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
        this.dirLight.position.set(200, 600, 200);
        this.dirLight.castShadow = true;

        // RESOLUSI BAYANGAN ADAPTIF: HP = 1024x1024, PC = 2048x2048
        const shadowSize = this.isMobile ? 1024 : 2048;
        this.dirLight.shadow.mapSize.width = shadowSize;
        this.dirLight.shadow.mapSize.height = shadowSize;
        
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 800;
        
        // Jangkauan kamera bayangan disesuaikan dengan jenis perangkat
        const shadowBounds = this.isMobile ? 100 : 200;
        this.dirLight.shadow.camera.left = -shadowBounds;
        this.dirLight.shadow.camera.right = shadowBounds;
        this.dirLight.shadow.camera.top = shadowBounds;
        this.dirLight.shadow.camera.bottom = -shadowBounds;
        
        // FIX SHADOW ACNE & GARIS-GARIS ANEH PADA PERMUKAAN DATAR
        this.dirLight.shadow.bias = -0.00005;
        this.dirLight.shadow.normalBias = 0.05;
        
        this.scene.add(this.dirLight);
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

        // Update Camera Far Plane (Memotong total objek di luar jarak pandang pada GPU)
        this.camera.far = targetFar;
        this.camera.updateProjectionMatrix();

        // Update Linear Fog agar batas potongan objek tersamarkan mulus dengan langit
        if (this.scene.fog) {
            this.scene.fog.near = Math.max(10, targetFar * 0.35);
            this.scene.fog.far = targetFar;
        }

        // Update Shadow Camera Far
        if (this.dirLight) {
            this.dirLight.shadow.camera.far = Math.min(targetFar, 800);
            this.dirLight.shadow.camera.updateProjectionMatrix();
        }
    }

    /**
     * Optimalisasi Jarak Objek (Distance Culling):
     * Menyembunyikan aset dunia yang jaraknya melebihi batas render agar GPU mengabaikan proses matriks & vertex
     * @param {THREE.Vector3} playerPos - Posisi koordinat pemain saat ini
     * @param {Array} placedAssetsList - Daftar aset objek yang diletakkan di map
     */
    updateDistanceCulling(playerPos, placedAssetsList = []) {
        if (!playerPos) return;

        const maxDistSq = this.currentMaxDistance * this.currentMaxDistance;

        placedAssetsList.forEach(asset => {
            if (asset && asset.mesh) {
                const distSq = playerPos.distanceToSquared(asset.mesh.position);
                // Matikan visibilitas objek di luar jarak pandang
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
            this.updatePixelRatio();
        });
    }

    /**
     * Mengeksekusi rendering frame 3D
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}