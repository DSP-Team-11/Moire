import numpy as np
import cv2
import base64
from typing import Optional, Tuple, Any

class ImageModel:
    def __init__(self, file_bytes: Optional[bytes] = None):
        self._raw_data = None  # Spatial Domain (Grayscale)
        self._fft_data = None  # Frequency Domain (Complex)
        self._shape = (0, 0)
        
        if file_bytes:
            self.load_from_bytes(file_bytes)

    # Getter and setter methods
    def get_raw_data(self) -> Optional[np.ndarray]:
        """Get the raw spatial domain image data."""
        return self._raw_data
    
    def set_raw_data(self, raw_data: np.ndarray) -> None:
        """Set raw image data and update FFT."""
        self._raw_data = raw_data
        self._shape = raw_data.shape
        self._update_fft()
    
    def get_fft_data(self) -> Optional[np.ndarray]:
        """Get the frequency domain FFT data."""
        return self._fft_data
    
    def set_fft_data(self, fft_data: np.ndarray) -> None:
        """Set FFT data directly (use with caution)."""
        self._fft_data = fft_data
        # Update shape from FFT data if raw data doesn't exist
        if self._raw_data is None and fft_data is not None:
            self._shape = fft_data.shape
    
    def get_shape(self) -> Tuple[int, int]:
        """Get the image shape."""
        return self._shape
    
    def set_shape(self, shape: Tuple[int, int]) -> None:
        """Set the image shape (triggers resize if raw_data exists)."""
        if self._raw_data is not None and self._shape != shape:
            self.resize(shape[0], shape[1])
        else:
            self._shape = shape
    
    def get_height(self) -> int:
        """Get the image height."""
        return self._shape[0] if self._shape else 0
    
    def get_width(self) -> int:
        """Get the image width."""
        return self._shape[1] if self._shape else 0
    
    def get_magnitude(self) -> Optional[np.ndarray]:
        """Get the magnitude spectrum."""
        return np.abs(self._fft_data) if self._fft_data is not None else None
    
    def get_phase(self) -> Optional[np.ndarray]:
        """Get the phase spectrum."""
        return np.angle(self._fft_data) if self._fft_data is not None else None
    
    def get_real(self) -> Optional[np.ndarray]:
        """Get the real part of FFT."""
        return np.real(self._fft_data) if self._fft_data is not None else None
    
    def get_imaginary(self) -> Optional[np.ndarray]:
        """Get the imaginary part of FFT."""
        return np.imag(self._fft_data) if self._fft_data is not None else None
    
    def get_log_magnitude(self) -> Optional[np.ndarray]:
        """Get log-scaled magnitude for display."""
        magnitude = self.get_magnitude()
        if magnitude is not None:
            return 20 * np.log(magnitude + 1e-9)
        return None
    
    def get_log_real(self) -> Optional[np.ndarray]:
        """Get log-scaled real part for display."""
        real = self.get_real()
        if real is not None:
            return 20 * np.log(np.abs(real) + 1e-9)
        return None
    
    def get_log_imaginary(self) -> Optional[np.ndarray]:
        """Get log-scaled imaginary part for display."""
        imag = self.get_imaginary()
        if imag is not None:
            return 20 * np.log(np.abs(imag) + 1e-9)
        return None
    
    def is_valid(self) -> bool:
        """Check if the image model contains valid data."""
        return self._raw_data is not None and self._fft_data is not None

    # Public methods
    def load_from_bytes(self, file_bytes: bytes) -> None:
        """Load image from bytes and calculate FFT."""
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        self.set_raw_data(img)
    
    def resize(self, new_h: int, new_w: int) -> None:
        """Resizes the internal image and re-calculates FFT."""
        if self._raw_data is None: 
            return
        if self._shape == (new_h, new_w): 
            return
        
        self._raw_data = cv2.resize(self._raw_data, (new_w, new_h))
        self._shape = self._raw_data.shape
        self._update_fft()
    
    def get_encoded_view(self, view_type: str) -> str:
        """Returns base64 string for a specific view type."""
        if self._raw_data is None: 
            return ""

        data = None
        if view_type == 'original': 
            data = self._raw_data
        elif view_type == 'mag':    
            data = self.get_log_magnitude()
        elif view_type == 'phase':  
            data = self.get_phase()  # Phase usually needs scaling
        elif view_type == 'real':   
            data = self.get_log_real()
        elif view_type == 'imag':   
            data = self.get_log_imaginary()
        else:
            raise ValueError(f"Unknown view type: {view_type}")

        if data is None:
            return ""
        
        # Normalize to 0-255 for display
        norm_img = cv2.normalize(data, None, 0, 255, cv2.NORM_MINMAX)
        norm_img = np.uint8(norm_img)
        
        _, buffer = cv2.imencode('.png', norm_img)
        return base64.b64encode(buffer).decode('utf-8')
    
    def clone(self) -> 'ImageModel':
        """Create a deep copy of the ImageModel."""
        clone = ImageModel()
        if self._raw_data is not None:
            clone.set_raw_data(self._raw_data.copy())
        return clone

    # Private method
    def _update_fft(self) -> None:
        """Calculates FFT and shifts zero frequency to center."""
        if self._raw_data is None: 
            return
        f = np.fft.fft2(self._raw_data)
        self._fft_data = np.fft.fftshift(f)
    
    @classmethod
    def from_array(cls, array: np.ndarray) -> 'ImageModel':
        """Create an ImageModel from a numpy array."""
        instance = cls()
        instance.set_raw_data(array)
        return instance
    
    @classmethod
    def from_file(cls, filepath: str) -> 'ImageModel':
        """Create an ImageModel from a file path."""
        with open(filepath, 'rb') as f:
            return cls(f.read())