import axios from 'axios';

const baseURL = import.meta.env.DEV
  ? '/api/eum'
  : (import.meta.env.VITE_EUM_BASE_URL || '/api/eum');

export const eumClient = axios.create({
  baseURL,
  timeout: 30_000,
  headers: {
    Accept: 'text/html, */*',
    'User-Agent': 'Mozilla/5.0 (compatible; LandNote/1.0)',
  },
  responseType: 'text',
});
