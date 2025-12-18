from .imagemodel import ImageModel

class ImageManager:
    def __init__(self):
        # Stores the 4 input ImageModel objects
        self.images = { '1': None, '2': None, '3': None, '4': None }
        # Stores output ImageModel objects
        self.outputs = { 'output_1': None, 'output_2': None }

    def upload_image(self, slot_id, file_bytes):
        new_img = ImageModel(file_bytes)
        self.images[slot_id] = new_img
        self._unify_sizes()

    def get_image(self, slot_id):
        return self.images.get(slot_id)

    def get_all(self):
        return self.images
    
    def store_output(self, output_key, image_model):
        """Store an output ImageModel"""
        if output_key in self.outputs:
            self.outputs[output_key] = image_model
    
    def get_output(self, output_key):
        """Retrieve an output ImageModel"""
        return self.outputs.get(output_key)
    
    def clear_outputs(self):
        """Clear all output images"""
        for key in self.outputs:
            self.outputs[key] = None
    
    def clear_output(self, output_key):
        """Clear specific output image"""
        if output_key in self.outputs:
            self.outputs[output_key] = None

    def _unify_sizes(self):
        """Ensures all images match the smallest dimensions"""
        valid_imgs = [img for img in self.images.values() if img is not None]
        if not valid_imgs: return

        min_h = min(img.shape[0] for img in valid_imgs)
        min_w = min(img.shape[1] for img in valid_imgs)

        for img in valid_imgs:
            img.resize(min_h, min_w)

# Singleton Instance
manager_instance = ImageManager()