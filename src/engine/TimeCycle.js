import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * Pengelola Siklus Waktu & Visual Langit (Matahari, Bulan, Bintang)
 */
export class TimeCycle {
    constructor(scene, dirLight, hemiLight) {
        this.scene = scene;
        this.dirLight = dirLight;
        this.hemiLight = hemiLight;

        this.dayTime = Math.PI / 2;
        this.timeMode = 'auto';

        this.sunSphere = new THREE.Vector3();
        this.hudTimeElement = null;

        this.buildSky();
    }

    buildSky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(10000);
        this.scene.add(this.sky);

        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = 10;
        uniforms['rayleigh'].value = 2;
        uniforms['mieCoefficient'].value = 0.005;
        uniforms['mieDirectionalG'].value = 0.8;

        const moonGeo = new THREE.SphereGeometry(15, 32, 32);
        const moonMat = new THREE.MeshStandardMaterial({
            color: 0xddddff,
            emissive: 0x111122,
            roughness: 0.8,
            metalness: 0.1
        });
        this.moonSphere = new THREE.Mesh(moonGeo, moonMat);
        this.scene.add(this.moonSphere);

        const starsGeo = new THREE.BufferGeometry();
        const starsVts = [];
        for (let i = 0; i < 1500; i++) {
            starsVts.push(
                (Math.random() - 0.5) * 2000,
                Math.random() * 1000 + 50,
                (Math.random() - 0.5) * 2000
            );
        }
        starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsVts, 3));
        const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.0, transparent: true, opacity: 0 });
        this.stars = new THREE.Points(starsGeo, starsMat);
        this.scene.add(this.stars);
    }

    update(delta) {
        if (this.timeMode === 'auto') {
            // Kecepatan disamakan dengan GTA V (24 jam game = 48 menit / 2880 detik nyata)
            const gtaVTimeSpeed = (Math.PI * 2) / 2880;
            this.dayTime += delta * gtaVTimeSpeed;
            if (this.dayTime > Math.PI * 2) this.dayTime -= Math.PI * 2;
        } else {
            let selectedHour = parseInt(this.timeMode);
            this.dayTime = ((selectedHour + 18) % 24) / 24 * (Math.PI * 2);
        }

        const sunHeight = Math.sin(this.dayTime);
        const distance = 400000;

        this.sunSphere.x = Math.cos(this.dayTime) * distance;
        this.sunSphere.y = sunHeight * distance;
        this.sunSphere.z = Math.sin(this.dayTime) * distance * 0.5;

        this.sky.material.uniforms['sunPosition'].value.copy(this.sunSphere);

        if (sunHeight > 0) {
            this.dirLight.position.set(this.sunSphere.x, this.sunSphere.y, this.sunSphere.z).normalize().multiplyScalar(100);
            let t = Math.min(sunHeight / 0.3, 1.0);
            this.dirLight.intensity = t * 2.0;
            this.hemiLight.intensity = 0.4 + (t * 0.4);

            if (sunHeight < 0.2) this.dirLight.color.set(0xffaa55);
            else this.dirLight.color.lerpColors(new THREE.Color(0xffaa55), new THREE.Color(0xffffff), (sunHeight - 0.2) / 0.8);

            this.scene.fog.color.lerpColors(new THREE.Color(0xff8c42), new THREE.Color(0x87ceeb), t);
        } else {
            this.dirLight.position.set(-this.sunSphere.x, -this.sunSphere.y, -this.sunSphere.z).normalize().multiplyScalar(100);
            let t = Math.min(Math.abs(sunHeight) / 0.3, 1.0);
            this.dirLight.intensity = t * 0.4;
            this.dirLight.color.set(0x88bbff);
            this.hemiLight.intensity = 0.1 + (t * 0.1);
            this.scene.fog.color.set(0x0a0a2a);
        }

        if (this.moonSphere) {
            this.moonSphere.position.copy(this.sunSphere).negate().normalize().multiplyScalar(500);
        }

        if (this.stars) {
            this.stars.material.opacity = Math.max(0, -sunHeight * 2);
        }

        // PERBAIKAN: Update teks Jam di HUD bawah minimap secara Real-time
        if (!this.hudTimeElement) {
            this.hudTimeElement = document.getElementById('hud-time');
        }
        if (this.hudTimeElement) {
            this.hudTimeElement.innerText = this.getFormattedTime();
        }
    }

    getFormattedTime() {
        let hoursFloat = ((this.dayTime / (Math.PI * 2)) * 24 + 6) % 24;
        let h = Math.floor(hoursFloat);
        let m = Math.floor((hoursFloat - h) * 60);
        let timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        let icon = (h >= 6 && h < 18) ? '☀️' : '🌙';
        return `${icon} ${timeStr}`;
    }
}