import numpy as np
import cv2
import base64

class UnifiedMixer:
    @staticmethod
    def mix(images_dict, weights_a, weights_b, mode, region_config, target_output_port=1):
        """
        Unified mixing function that handles both basic and region mixing.
        
        Args:
            images_dict: Dictionary of image slots (1-4) to Image objects
            weights_a: Sliders for Column 1 (Mag/Real)
            weights_b: Sliders for Column 2 (Phase/Imag)
            mode: 'magnitude_phase' or 'real_imag'
            region_config: {
                'size': percentage (0-100),  # For backward compatibility (only used in basic mode)
                'inner': boolean,  # For backward compatibility (only used in basic mode)
                'regions': {  # Required for region mixing mode
                    '1': {'type': 'inner/outer', 'x': %, 'y': %, 'width': %, 'height': %},
                    '2': {...},
                    '3': {...},
                    '4': {...}
                }
            }
            target_output_port: Which output port to save to (1 or 2) - optional
        
        Returns: (result_numpy_array, result_base64_string)
        """
        # Filter out empty slots
        valid_imgs = {k: v for k, v in images_dict.items() if v is not None}
        if not valid_imgs: 
            return None, None
        
        # Get reference dimensions from first valid image
        h, w = next(iter(valid_imgs.values())).shape

        # Initialize accumulators
        comp1_acc = np.zeros((h, w), dtype=np.complex128)
        comp2_acc = np.zeros((h, w), dtype=np.complex128)
        
        # Check if we have per-component regions (region mixing mode)
        regions = region_config.get('regions', {})
        has_per_component_regions = bool(regions)
        
        # Generate mask(s)
        if has_per_component_regions:
            # Region mixing mode: generate individual masks for each component
            masks = {}
            for slot_str in ['1', '2', '3', '4']:
                if slot_str in regions:
                    region = regions[slot_str]
                    masks[slot_str] = UnifiedMixer._generate_custom_mask(h, w, region)
                else:
                    # Default to full inner region if not specified
                    masks[slot_str] = np.ones((h, w), dtype=np.float32)
        else:
            # Basic mixing mode: single unified mask
            mask = UnifiedMixer._generate_unified_mask(h, w, region_config)
            masks = {str(i): mask for i in range(1, 5)}  # Same mask for all

        # Process each image
        for slot, img in images_dict.items():
            if img is None: 
                continue
            
            # Normalize sliders (0-10 -> 0.0-1.0)
            wa = weights_a.get(str(slot), 0) / 10.0
            wb = weights_b.get(str(slot), 0) / 10.0

            # Skip if both weights are zero
            if wa == 0 and wb == 0:
                continue

            # Get frequency domain components based on mode
            if mode == 'magnitude_phase':
                c1 = img.get_magnitude()
                c2 = img.get_phase()
            else:
                c1 = img.get_real()
                c2 = img.get_imaginary()

            # Get mask for this slot
            slot_str = str(slot)
            mask = masks.get(slot_str, np.ones((h, w), dtype=np.float32))
            
            # Apply Region Filtering
            if has_per_component_regions:
                # Region mode: check if we should use inner or outer region
                region_type = regions.get(slot_str, {}).get('type', 'inner')
                if region_type == 'inner':
                    c1 = c1 * mask
                    c2 = c2 * mask
                else:  # outer
                    c1 = c1 * (1 - mask)
                    c2 = c2 * (1 - mask)
            else:
                # Basic mode: use the 'inner' flag from region_config
                if region_config.get('inner', True):
                    c1 = c1 * mask
                    c2 = c2 * mask
                else:
                    c1 = c1 * (1 - mask)
                    c2 = c2 * (1 - mask)

            comp1_acc += c1 * wa
            comp2_acc += c2 * wb

        # Reconstruct
        result_complex = None
        if mode == 'magnitude_phase':
            result_complex = comp1_acc * np.exp(1j * comp2_acc)
        else:
            result_complex = comp1_acc + 1j * comp2_acc

        # IFFT
        f_ishift = np.fft.ifftshift(result_complex)
        img_back = np.fft.ifft2(f_ishift)
        img_back = np.abs(img_back)

        # Store the numpy array
        result_array = img_back.copy()

        # Encode to base64 for immediate display
        img_back = cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX)
        img_back = np.uint8(img_back)
        _, buffer = cv2.imencode('.png', img_back)
        result_b64 = base64.b64encode(buffer).decode('utf-8')

        return result_array, result_b64

    @staticmethod
    def _generate_unified_mask(h, w, config):
        """
        Generate a single centered rectangular mask (for basic mixing mode).
        
        Args:
            h, w: Height and width of the image
            config: {'size': percentage, 'inner': boolean}
        
        Returns:
            Binary mask (1 inside region, 0 outside)
        """
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

    @staticmethod
    def _generate_custom_mask(h, w, region):
        """
        Generate a custom rectangular mask at specified position (for region mixing mode).
        
        Args:
            h, w: Height and width of the image
            region: {'x': %, 'y': %, 'width': %, 'height': %}
        
        Returns:
            Binary mask (1 inside region, 0 outside)
        """
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
    def get_default_region_config(mode='basic'):
        """
        Get default region configurations for UI initialization.
        
        Args:
            mode: 'basic' or 'region'
        
        Returns:
            Default region configuration dictionary
        """
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
        else:  # region mode
            return {
                'size': 100,  # Not used in region mode, kept for compatibility
                'inner': True,  # Not used in region mode, kept for compatibility
                'regions': {
                    '1': {'type': 'inner', 'x': 25, 'y': 25, 'width': 50, 'height': 50},
                    '2': {'type': 'inner', 'x': 25, 'y': 25, 'width': 50, 'height': 50},
                    '3': {'type': 'inner', 'x': 25, 'y': 25, 'width': 50, 'height': 50},
                    '4': {'type': 'inner', 'x': 25, 'y': 25, 'width': 50, 'height': 50}
                }
            }