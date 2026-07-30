import * as THREE from 'three';

/**
 * Pengelola Dunia (Terrain, Canvas Painting, Rintangan Dasar, Asset Terpasang)
 */
export class World {
    constructor(scene) {
        this.scene = scene;
        this.baseObstacles = [];
        this.baseObstacleMeshes = [];
        this.placedAssetsList = [];

        this.initTerrainCanvas();
        this.buildDefaultWorld();
    }

    /**
     * Inisialisasi kanvas tekstur tanah dan pemuatan gambar dasar
     */
    initTerrainCanvas() {
        this.floorCanvas = document.createElement('canvas');
        this.floorCanvas.width = 2048;
        this.floorCanvas.height = 2048;
        this.floorCtx = this.floorCanvas.getContext('2d');

        this.floorCtx.fillStyle = '#3a4f29';
        this.floorCtx.fillRect(0, 0, 2048, 2048);

        const baseImg = new Image();
        baseImg.src = '/assets/textures/ground_base.png';
        baseImg.onload = () => {
            const pattern = this.floorCtx.createPattern(baseImg, 'repeat');
            this.floorCtx.fillStyle = pattern;
            this.floorCtx.fillRect(0, 0, 2048, 2048);
            this.floorTex.needsUpdate = true;
        };

        this.floorTex = new THREE.CanvasTexture(this.floorCanvas);
        this.floorTex.colorSpace = THREE.SRGBColorSpace;

        const floorGeo = new THREE.PlaneGeometry(200, 200, 100, 100);
        const floorMat = new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.9 });
        this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.receiveShadow = true;
        this.scene.add(this.floorMesh);
    }

    /**
     * Membuat objek bawaan saat game dimulai (Dikosongkan)
     */
    buildDefaultWorld() {
        // Map diawali murni sebagai lahan kosong tanpa rintangan dummy
    }

    /**
     * Membuat kubus rintangan baru secara manual
     */
    createBox(w, h, d, x, z, color) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        this.baseObstacles.push(box);
        this.baseObstacleMeshes.push(mesh);
    }

    /**
     * Pahat dan bentuk ketinggian tanah (Gunung / Lembah)
     */
    sculptTerrain(point, brushSize, tool, delta, isLeftDown, isRightDown) {
        const positions = this.floorMesh.geometry.attributes.position;
        const localPoint = this.floorMesh.worldToLocal(point.clone());
        const sculptStrength = 20.0 * delta;

        let sumHeight = 0, count = 0;
        let affectedVerts = [];

        for (let i = 0; i < positions.count; i++) {
            const vx = positions.getX(i);
            const vy = positions.getY(i);
            const dist = Math.sqrt((vx - localPoint.x) ** 2 + (vy - localPoint.y) ** 2);

            if (dist < brushSize) {
                const falloff = Math.cos((dist / brushSize) * (Math.PI / 2));
                affectedVerts.push({ index: i, falloff: falloff });
                sumHeight += positions.getZ(i);
                count++;
            }
        }

        if (isLeftDown) {
            for (let v of affectedVerts) {
                let curZ = positions.getZ(v.index);
                if (tool === 1) curZ += sculptStrength * v.falloff;
                else curZ -= sculptStrength * v.falloff;
                positions.setZ(v.index, curZ);
            }
        } else if (isRightDown && count > 0) {
            let avgHeight = sumHeight / count;
            let smoothRate = 10.0 * delta;
            for (let v of affectedVerts) {
                let curZ = positions.getZ(v.index);
                let newZ = curZ + (avgHeight - curZ) * smoothRate * v.falloff;
                positions.setZ(v.index, newZ);
            }
        }
        this.floorMesh.geometry.attributes.position.needsUpdate = true;
        this.floorMesh.geometry.computeVertexNormals();
    }

    /**
     * Melukis corak tekstur pada area kanvas tanah menggunakan Tool 5
     */
    paintTerrainTexture(uv, brushSize, textureImage) {
        // Validasi keamanan gambar untuk mencegah error context canvas
        if (!uv || !textureImage || !textureImage.complete || textureImage.naturalWidth === 0) return;

        const pxPerUnit = 2048 / 200;
        const brushRadiusPx = brushSize * pxPerUnit;
        const centerX = uv.x * 2048;
        const centerY = (1.0 - uv.y) * 2048;

        this.floorCtx.save();
        this.floorCtx.beginPath();
        this.floorCtx.arc(centerX, centerY, brushRadiusPx, 0, Math.PI * 2);
        this.floorCtx.clip();

        const pattern = this.floorCtx.createPattern(textureImage, 'repeat');
        const matrix = new DOMMatrix().scale(0.5, 0.5);
        pattern.setTransform(matrix);

        this.floorCtx.fillStyle = pattern;
        this.floorCtx.fillRect(centerX - brushRadiusPx, centerY - brushRadiusPx, brushRadiusPx * 2, brushRadiusPx * 2);
        this.floorCtx.restore();

        this.floorTex.needsUpdate = true;
    }
}