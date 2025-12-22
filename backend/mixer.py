# mixer.py
import numpy as np
import cv2
import base64
from typing import Dict, Optional, Tuple, Any

class UnifiedMixer:
    def __init__(self):
        self._images_dict = {}
        self._weights_a = {}
        self._weights_b = {}
        self._mode = 'magnitude_phase'
        self._region_config = self.get_default_region_config('basic')
        self._masks = {}
        self._result_array = None
        self._result_b64 = None
        
    # Getter and setter methods
    def get_images_dict(self) -> Dict:
        return self._images_dict
    
    def set_images_dict(self, images_dict: Dict) -> None:
        self._images_dict = images_dict
    
    def get_weights_a(self) -> Dict:
        return self._weights_a
    
    def set_weights_a(self, weights_a: Dict) -> None:
        self._weights_a = weights_a
    
    def get_weights_b(self) -> Dict:
        return self._weights_b
    
    def set_weights_b(self, weights_b: Dict) -> None:
        self._weights_b = weights_b
    
    def get_mode(self) -> str:
        return self._mode
    
    def set_mode(self, mode: str) -> None:
        if mode not in ['magnitude_phase', 'real_imag']:
            raise ValueError("Mode must be 'magnitude_phase' or 'real_imag'")
        self._mode = mode
    
    def get_region_config(self) -> Dict:
        return self._region_config
    
    def set_region_config(self, region_config: Dict) -> None:
        self._region_config = region_config
    
    def get_result_array(self) -> Optional[np.ndarray]:
        return self._result_array
    
    def get_result_b64(self) -> Optional[str]:
        return self._result_b64
    
    def get_masks(self) -> Dict:
        return self._masks
    
    def mix(self) -> Tuple[Optional[np.ndarray], Optional[str]]:
        """
        Unified mixing function (Optimized).
        """
        # Use getters to access the data
        images_dict = self.get_images_dict()
        weights_a = self.get_weights_a()
        weights_b = self.get_weights_b()
        mode = self.get_mode()
        region_config = self.get_region_config()
        
        # 1. Filter out empty slots
        valid_imgs = {k: v for k, v in images_dict.items() if v is not None}
        if not valid_imgs: 
            self._result_array = None
            self._result_b64 = None
            return None, None
        
        # 2. Get reference dimensions - FIXED: Use get_shape()
        first_img = next(iter(valid_imgs.values()))
        h, w = first_img.get_shape()  # Changed from .shape to .get_shape()
        
        # 3. Initialize Accumulators
        if mode == 'magnitude_phase':
            acc1 = np.zeros((h, w), dtype=np.float64)
            acc2 = np.zeros((h, w), dtype=np.complex128)
        else:
            acc1 = np.zeros((h, w), dtype=np.complex128)
            acc2 = np.zeros((h, w), dtype=np.complex128)

        # 4. Generate Masks
        regions = region_config.get('regions', {})
        hasRegion_comp = bool(regions)
        
        masks = {}
        if hasRegion_comp:
            for slot_str in ['1', '2', '3', '4']:
                if slot_str in regions:
                    masks[slot_str] = self._generate_custom_mask(h, w, regions[slot_str])
                else:
                    masks[slot_str] = np.ones((h, w), dtype=np.float32)
        else:
            global_mask = self._generate_unified_mask(h, w, region_config)
            masks = {str(i): global_mask for i in range(1, 5)}
        
        self._masks = masks

        # 5. Process Images
        sum_wa = 0
        sum_wb = 0
        
        for slot, img in images_dict.items():
            if img is None: continue
            
            wa = weights_a.get(str(slot), 0) / 10.0
            wb = weights_b.get(str(slot), 0) / 10.0

            sum_wa += wa
            sum_wb += wb

            if wa == 0 and wb == 0: continue

            # Get Components
            if mode == 'magnitude_phase':
                c1 = img.get_magnitude()
                c2 = img.get_phase()
            else:
                c1 = img.get_real()
                c2 = img.get_imaginary()

            # Determine Masking Logic
            slot_str = str(slot)
            current_mask = masks.get(slot_str, np.ones((h, w), dtype=np.float32))
            
            is_outer = False
            if hasRegion_comp:
                if regions.get(slot_str, {}).get('type') == 'outer':
                    is_outer = True
            else:
                if not region_config.get('inner', True):
                    is_outer = True
            
            final_mask = (1 - current_mask) if is_outer else current_mask
            
            c1 = c1 * final_mask
            c2 = c2 * final_mask

            # Accumulate
            if mode == 'magnitude_phase':
                acc1 += c1 * wa
                acc2 += wb * np.exp(1j * c2)
            else:
                acc1 += c1 * wa
                acc2 += c2 * wb

        # 6. Normalize & Reconstruct
        if mode == 'magnitude_phase':
            acc1 /= max(sum_wa, 1e-6)
            
            if np.allclose(acc2, 0):
                final_phase = np.zeros((h, w), dtype=np.float64)
            else:
                acc2 /= max(sum_wb, 1e-6)
                final_phase = np.angle(acc2)
            
            result_complex = acc1 * np.exp(1j * final_phase)
            
        else:
            acc1 /= max(sum_wa, 1e-6)
            acc2 /= max(sum_wb, 1e-6)
            result_complex = acc1 + 1j * acc2

        # 7. Inverse FFT
        f_ishift = np.fft.ifftshift(result_complex)
        img_back = np.fft.ifft2(f_ishift)
        img_back = np.real(img_back)

        # 8. Post-Processing for Display
        result_array = img_back.copy()
        
        # Normalize to 0-255
        img_normalized = cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX)
        img_normalized = np.uint8(img_normalized)
        
        # Encode to Base64
        _, buffer = cv2.imencode('.png', img_normalized)
        result_b64 = base64.b64encode(buffer).decode('utf-8')

        # Store results
        self._result_array = result_array
        self._result_b64 = result_b64

        return result_array, result_b64

    def _generate_unified_mask(self, h: int, w: int, config: Dict) -> np.ndarray:
        mask = np.zeros((h, w), dtype=np.float32)
        cy, cx = h // 2, w // 2
        percent = config.get('size', 100)
        rh = int((percent / 100) * h)
        rw = int((percent / 100) * w)
        
        y1 = max(0, cy - rh//2)
        y2 = min(h, cy + rh//2)
        x1 = max(0, cx - rw//2)
        x2 = min(w, cx + rw//2)
        
        mask[y1:y2, x1:x2] = 1
        return mask

    def _generate_custom_mask(self, h: int, w: int, region: Dict) -> np.ndarray:
        mask = np.zeros((h, w), dtype=np.float32)
        
        # Convert percentages to pixels
        x_percent = region.get('x', 0)
        y_percent = region.get('y', 0)
        width_percent = region.get('width', 100)
        height_percent = region.get('height', 100)
        
        x_px = int(w * x_percent / 100)
        y_px = int(h * y_percent / 100)
        width_px = int(w * width_percent / 100)
        height_px = int(h * height_percent / 100)
        
        # Constrain to image bounds
        x1 = max(0, x_px)
        x2 = min(w, x_px + width_px)
        y1 = max(0, y_px)
        y2 = min(h, y_px + height_px)
        
        mask[y1:y2, x1:x2] = 1
        return mask

    @staticmethod
    def get_default_region_config(mode: str = 'basic') -> Dict:
        if mode == 'basic':
            return {
                'size': 100,
                'inner': True,
                'regions': {
                    '1': {'type': 'inner', 'x': 0, 'y': 0, 'width': 100, 'height': 100},
                    '2': {'type': 'inner', 'x': 0, 'y': 0, 'width': 100, 'height': 100},
                    '3': {'type': 'inner', 'x': 0, 'y': 0, 'width': 100, 'height': 100},
                    '4': {'type': 'inner', 'x': 0, 'y': 0, 'width': 100, 'height': 100}
                }
            }
        else:
            return {}
    
    @classmethod
    def static_mix(cls, images_dict: Dict, weights_a: Dict, weights_b: Dict, 
                   mode: str, region_config: Dict) -> Tuple[Optional[np.ndarray], Optional[str]]:
        """
        Static method for backward compatibility.
        """
        mixer = cls()
        mixer.set_images_dict(images_dict)
        mixer.set_weights_a(weights_a)
        mixer.set_weights_b(weights_b)
        mixer.set_mode(mode)
        mixer.set_region_config(region_config)
        
        return mixer.mix()