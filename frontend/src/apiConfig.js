// Konfigurasi dinamis API URL:
// Mengikuti IP host yang sedang diakses (misal http://172.20.10.3:5000 jika diakses via LAN / Network)
export const API = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
