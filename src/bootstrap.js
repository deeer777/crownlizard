const params = new URLSearchParams(location.search);
const localPreview = location.hostname === '127.0.0.1' || location.hostname === 'localhost';

if (localPreview && params.has('controls')) {
  import('./control-lab.js?v=20260905-109-adsense-verification');
} else {
  import('./main.js?v=20260905-109-adsense-verification');
}
