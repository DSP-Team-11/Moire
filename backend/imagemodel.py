import numpy as np
import cv2
import base64

class ImageModel:
    def __init__(self, file_bytes=None):
        self.raw_data = None  # Spatial Domain (Grayscale)
        self.fft_data = None  # Frequency Domain (Complex)
        self.shape = (0, 0)
        
        if file_bytes:
            self._load_from_bytes(file_bytes)

    def _load_from_bytes(self, file_bytes):
        """Private: Decodes bytes to Grayscale Opencv Image"""
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        self.raw_data = img
        self.shape = img.shape
        self._update_fft()

    def resize(self, new_h, new_w):
        """Resizes the internal image and re-calculates FFT"""
        if self.raw_data is None: return
        if self.shape == (new_h, new_w): return
        
        self.raw_data = cv2.resize(self.raw_data, (new_w, new_h))
        self.shape = self.raw_data.shape
        self._update_fft()

    def _update_fft(self):
        """Calculates FFT and shifts zero frequency to center"""
        if self.raw_data is None: return
        f = np.fft.fft2(self.raw_data)
        self.fft_data = np.fft.fftshift(f)

    # --- Getters (Encapsulation) ---
    def get_magnitude(self):
        return np.abs(self.fft_data) if self.fft_data is not None else None

    def get_phase(self):
        return np.angle(self.fft_data) if self.fft_data is not None else None

    def get_real(self):
        return np.real(self.fft_data) if self.fft_data is not None else None

    def get_imaginary(self):
        return np.imag(self.fft_data) if self.fft_data is not None else None

    # --- View Helper ---
    def get_encoded_view(self, view_type):
        """Returns base64 string for a specific view type"""
        if self.raw_data is None: return ""

        data = None
        if view_type == 'original': data = self.raw_data
        elif view_type == 'mag':    data = 20 * np.log(self.get_magnitude() + 1e-9)
        elif view_type == 'phase':  data = self.get_phase() # Phase usually needs scaling
        elif view_type == 'real':   data = 20 * np.log(np.abs(self.get_real()) + 1e-9)
        elif view_type == 'imag':   data = 20 * np.log(np.abs(self.get_imaginary()) + 1e-9)

        # Normalize to 0-255 for display
        norm_img = cv2.normalize(data, None, 0, 255, cv2.NORM_MINMAX)
        norm_img = np.uint8(norm_img)
        
        _, buffer = cv2.imencode('.png', norm_img)
        return base64.b64encode(buffer).decode('utf-8')