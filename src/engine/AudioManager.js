import { Howl, Howler } from 'howler';

/**
 * Pengelola Sistem Audio 3D dan Sound Effects (SFX)
 */
export class AudioManager {
    constructor() {
        this.isMuted = false;
        
        // Inisialisasi Database Suara
        this.sounds = {
            // Suara langkah di rumput/tanah
            grass: new Howl({
                src: ['/assets/audio/footstep_grass.mp3'], 
                volume: 0.6,
            }),
            // Suara langkah di aspal/semen/lantai
            street: new Howl({
                src: ['/assets/audio/footstep_street.mp3'], 
                volume: 0.6,
            }),
            // Suara langkah di lantai kayu/papan/rumah
            wood: new Howl({
                src: ['/assets/audio/footstep_wood.mp3'], 
                volume: 1.5, // DIBOOST: Base volume khusus kayu dinaikkan agar seimbang dengan yang lain
            }),
            // Suara ambience angin
            wind: new Howl({
                src: ['/assets/audio/wind.mp3'], 
                volume: 0.3,
                loop: true
            })
        };

        // Volume master global awal (0.0 sampai 1.0)
        Howler.volume(1.0);
    }

    /**
     * Memainkan efek suara langkah kaki dengan tipe permukaan dinamis
     * @param {string} type - Kecepatan ('walk' atau 'run')
     * @param {string} surface - Permukaan ('grass', 'street', atau 'wood')
     */
    playFootstep(type = 'walk', surface = 'street') {
        if (this.isMuted) return;
        
        // Pilih suara berdasarkan permukaan (default: aspal/street)
        const soundToPlay = this.sounds[surface] || this.sounds.street;
        
        // Acak sedikit pitch (rate) biar suara langkah kaki nggak monoton/robotik
        const rate = type === 'run' ? (1.1 + Math.random() * 0.2) : (0.9 + Math.random() * 0.2);
        
        soundToPlay.rate(rate);
        soundToPlay.play();
    }

    /**
     * Mengatur Volume Master Global (Semua Suara)
     * @param {number} value - Angka dari 0.0 (Bisu) sampai 1.0 (Maksimal)
     */
    setMasterVolume(value) {
        const volumeLevel = Math.max(0.0, Math.min(1.0, parseFloat(value)));
        
        // Update volume master di Howler
        Howler.volume(volumeLevel);
        
        // Auto-mute kalau volume 0 biar ringan di CPU
        this.isMuted = (volumeLevel <= 0.0);
    }

    /**
     * Memulai pemutaran BGM / Ambience latar belakang
     */
    startAmbience() {
        if (this.isMuted) return;
        if (!this.sounds.wind.playing()) {
            this.sounds.wind.play();
        }
    }
    
    stopAmbience() {
        this.sounds.wind.stop();
    }
}