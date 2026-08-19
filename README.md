# 🌆 Project Roppan 3D

![Three.js](https://img.shields.io/badge/Three.js-Black?style=for-the-badge&logo=three.js&logoColor=white)
![Rapier Physics](https://img.shields.io/badge/Rapier_Physics-FF5D00?style=for-the-badge&logo=physics&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white)

**Project Roppan 3D** adalah sebuah prototipe *game engine* berbasis WebGL yang menawarkan pengalaman eksplorasi *Open-World* langsung di dalam browser. Dibangun menggunakan **Three.js** untuk rendering grafis tingkat lanjut dan **Rapier3D** untuk simulasi fisika yang akurat.

Project ini difokuskan pada optimasi performa tinggi (60 FPS) di lingkungan *web* tanpa mengorbankan kualitas visual dan kompleksitas mekanik permainan.

---

## ✨ Fitur Utama

### 🏃‍♂️ Advanced Player Controller & Parkour System
*   **AAA Physics-Based Movement:** Dilengkapi dengan sistem inersia, akselerasi, dan momentum natural.
*   **Smart Vaulting & Climbing:** Sensor *Raycaster* adaptif yang mampu mendeteksi tinggi objek. Karakter dapat melakukan *Ground Vault* untuk pagar rendah (≤ 2.0m) atau *Mid-Air Ledge Grab* untuk memanjat gedung/tembok tinggi (≤ 2.6m).
*   **Action Mechanics:** Mendukung *Sprinting*, *Sneaking*, *Rolling*, dan *Sliding* yang terikat dengan sistem *Stamina*.
*   **Dynamic VFX & Audio:** Efek debu (*particle system*) yang responsif terhadap pijakan dan pendaratan, serta *footstep audio* yang menyesuaikan dengan material permukaan (Aspal, Kayu, Rumput).

### 🌃 Smart Light Pooling & Rendering Optimization
*   **Frustum Culling & Teleportation:** Menggunakan teknik *Object Pooling* untuk me-render ratusan lampu jalan di malam hari tanpa menyebabkan *lag* atau kompilasi ulang *shader*. Lampu hanya akan aktif dan dipindahkan secara instan ke area yang masuk dalam jangkauan kamera.
*   **Draco Compression:** Seluruh map dikompresi secara maksimal, memangkas ukuran file hingga 77% untuk waktu pemuatan (*loading*) yang sangat cepat di *browser*.
*   **Inverse-Square Law Lighting:** Pencahayaan yang dikalibrasi sesuai dengan fisika cahaya dunia nyata untuk menghasilkan pendaran yang realistis.

### 🌍 Dynamic Open World Environment
*   **Real-Time TimeCycle:** Siklus rotasi siang dan malam (Matahari, Bulan, Bintang) yang berjalan otomatis.
*   **Sync Automation:** Lampu jalan raya (*Street Lamps*) akan otomatis menyala pada pukul 17:30 dan padam pada pukul 06:00.
*   **Interactive Wind Shader:** Pepohonan dan dedaunan yang bergoyang terkena angin, serta bereaksi menjauh saat ditabrak atau dilewati oleh pemain.

### 🛠️ In-Game World Editor (Developer Mode)
*   **Terrain Sculpting:** Kemampuan memodifikasi bentuk tanah (membuat gunung/lembah).
*   **Asset Placement:** Menempatkan, menggeser, memutar, dan menghapus objek 3D secara *real-time*.
*   **Texture Painting:** Mengecat tekstur langsung ke atas *mesh* dunia.

---

## 🎮 Kontrol Permainan

| Aksi | Keyboard / Mouse | Mobile |
| :--- | :--- | :--- |
| **Bergerak** | `W`, `A`, `S`, `D` | `On-Screen Joystick` |
| **Kamera** | `Pergerakan Mouse` | `Touch & Swipe Layar` |
| **Lompat / Panjat** | `Space` | Tombol `LOMPAT` |
| **Lari (Sprint)** | `Shift` (Tahan) | Tombol `LARI` |
| **Jongkok (Sneak)** | `C` | - |
| **Sliding** | `Shift` + `C` (Saat Berlari) | - |
| **Berguling (Roll)** | `Alt` | - |

---

## 🚀 Cara Menjalankan Project Secara Lokal

1. **Clone Repository**
   ```bash
   git clone [https://github.com/username-lo/nama-repo-lo.git](https://github.com/username-lo/nama-repo-lo.git)
   cd nama-repo-lo