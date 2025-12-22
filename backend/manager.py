from typing import Dict, Optional, List, Any, Union
from .imagemodel import ImageModel

class ImageManager:
    _instance = None  # For singleton pattern
    
    def __init__(self):
        # Private storage for input images
        self._input_images = { '1': None, '2': None, '3': None, '4': None }
        # Private storage for output images
        self._output_images = { 'output_1': None, 'output_2': None }
        # Configuration
        self._auto_resize = True
        self._default_width = 512
        self._default_height = 512

    # Getter and setter methods
    def get_input_image(self, slot_id: str) -> Optional[ImageModel]:
        """Get an input image from a specific slot."""
        if slot_id not in self._input_images:
            raise KeyError(f"Invalid slot ID: {slot_id}. Must be '1', '2', '3', or '4'")
        return self._input_images.get(slot_id)
    
    def set_input_image(self, slot_id: str, image_model: Optional[ImageModel]) -> None:
        """Set an input image in a specific slot."""
        if slot_id not in self._input_images:
            raise KeyError(f"Invalid slot ID: {slot_id}. Must be '1', '2', '3', or '4'")
        self._input_images[slot_id] = image_model
        if self._auto_resize and image_model is not None:
            self._unify_sizes()
    
    def get_output_image(self, output_key: str) -> Optional[ImageModel]:
        """Get an output image."""
        if output_key not in self._output_images:
            raise KeyError(f"Invalid output key: {output_key}")
        return self._output_images.get(output_key)
    
    def set_output_image(self, output_key: str, image_model: Optional[ImageModel]) -> None:
        """Set an output image."""
        if output_key not in self._output_images:
            raise KeyError(f"Invalid output key: {output_key}")
        self._output_images[output_key] = image_model
    
    def get_all_inputs(self) -> Dict[str, Optional[ImageModel]]:
        """Get all input images."""
        return self._input_images.copy()  # Return copy to prevent external modification
    
    def get_all_outputs(self) -> Dict[str, Optional[ImageModel]]:
        """Get all output images."""
        return self._output_images.copy()  # Return copy to prevent external modification
    
    def get_valid_inputs(self) -> Dict[str, ImageModel]:
        """Get only valid (non-None) input images."""
        return {k: v for k, v in self._input_images.items() if v is not None}
    
    def get_valid_outputs(self) -> Dict[str, ImageModel]:
        """Get only valid (non-None) output images."""
        return {k: v for k, v in self._output_images.items() if v is not None}
    
    def get_auto_resize(self) -> bool:
        """Check if auto-resize is enabled."""
        return self._auto_resize
    
    def set_auto_resize(self, enabled: bool) -> None:
        """Enable or disable auto-resize."""
        self._auto_resize = enabled
    
    def get_default_dimensions(self) -> tuple:
        """Get default dimensions for new images."""
        return (self._default_height, self._default_width)
    
    def set_default_dimensions(self, height: int, width: int) -> None:
        """Set default dimensions for new images."""
        if height <= 0 or width <= 0:
            raise ValueError("Dimensions must be positive integers")
        self._default_height = height
        self._default_width = width
    
    def get_input_slot_count(self) -> int:
        """Get the number of input slots."""
        return len(self._input_images)
    
    def get_output_slot_count(self) -> int:
        """Get the number of output slots."""
        return len(self._output_images)
    
    def get_input_slot_ids(self) -> List[str]:
        """Get list of input slot IDs."""
        return list(self._input_images.keys())
    
    def get_output_slot_ids(self) -> List[str]:
        """Get list of output slot IDs."""
        return list(self._output_images.keys())
    
    def get_image_count(self) -> Dict[str, int]:
        """Get count of images in manager."""
        return {
            'input': len(self.get_valid_inputs()),
            'output': len(self.get_valid_outputs())
        }

    # Public methods for image management
    def upload_image(self, slot_id: str, file_bytes: bytes) -> ImageModel:
        """
        Upload and create an ImageModel from bytes.
        
        Args:
            slot_id: Slot identifier ('1', '2', '3', or '4')
            file_bytes: Image bytes
            
        Returns:
            Created ImageModel instance
        """
        if slot_id not in self._input_images:
            raise KeyError(f"Invalid slot ID: {slot_id}")
        
        new_img = ImageModel(file_bytes)
        self.set_input_image(slot_id, new_img)
        return new_img
    
    def store_output(self, output_key: str, image_model: ImageModel) -> None:
        """
        Store an output ImageModel.
        
        Args:
            output_key: Output identifier ('output_1' or 'output_2')
            image_model: ImageModel instance to store
        """
        self.set_output_image(output_key, image_model)
    
    def clear_all_inputs(self) -> None:
        """Clear all input images."""
        for key in self._input_images:
            self._input_images[key] = None
    
    def clear_input(self, slot_id: str) -> bool:
        """
        Clear a specific input slot.
        
        Args:
            slot_id: Slot identifier to clear
            
        Returns:
            True if cleared, False if slot doesn't exist
        """
        if slot_id not in self._input_images:
            return False
        
        self._input_images[slot_id] = None
        return True
    
    def clear_all_outputs(self) -> None:
        """Clear all output images."""
        for key in self._output_images:
            self._output_images[key] = None
    
    def clear_output(self, output_key: str) -> bool:
        """
        Clear a specific output image.
        
        Args:
            output_key: Output key to clear
            
        Returns:
            True if cleared, False if key doesn't exist
        """
        if output_key not in self._output_images:
            return False
        
        self._output_images[output_key] = None
        return True
    
    def clear_all(self) -> None:
        """Clear all images (inputs and outputs)."""
        self.clear_all_inputs()
        self.clear_all_outputs()
    
    def resize_all_inputs(self, height: int, width: int) -> None:
        """
        Resize all input images to specified dimensions.
        
        Args:
            height: Target height
            width: Target width
        """
        for img in self.get_valid_inputs().values():
            img.resize(height, width)
    
    def clone(self) -> 'ImageManager':
        """
        Create a deep copy of the ImageManager.
        
        Returns:
            Cloned ImageManager instance
        """
        clone = ImageManager()
        
        # Clone input images
        for key, img in self._input_images.items():
            if img is not None:
                clone._input_images[key] = img.clone()
        
        # Clone output images
        for key, img in self._output_images.items():
            if img is not None:
                clone._output_images[key] = img.clone()
        
        clone._auto_resize = self._auto_resize
        clone._default_width = self._default_width
        clone._default_height = self._default_height
        
        return clone

    # In manager.py, update the _unify_sizes method:

    def _unify_sizes(self) -> None:
        """Ensures all images match the smallest dimensions."""
        valid_imgs = list(self.get_valid_inputs().values())
        if not valid_imgs:
            return

        # Get minimum dimensions using getter methods
        min_h = min(img.get_height() for img in valid_imgs)
        min_w = min(img.get_width() for img in valid_imgs)
        
        # Resize all images
        for img in valid_imgs:
            img.resize(min_h, min_w)
    
    def _validate_slot_id(self, slot_id: str) -> bool:
        """Validate slot ID."""
        return slot_id in self._input_images
    
    def _validate_output_key(self, output_key: str) -> bool:
        """Validate output key."""
        return output_key in self._output_images

    @classmethod
    def get_instance(cls) -> 'ImageManager':
        """
        Get the singleton instance of ImageManager.
        
        Returns:
            Singleton ImageManager instance
        """
        if cls._instance is None:
            cls._instance = ImageManager()
        return cls._instance

# Singleton Instance (for backward compatibility)
manager_instance = ImageManager.get_instance()