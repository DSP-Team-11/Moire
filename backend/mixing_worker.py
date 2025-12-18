import threading
import time
import numpy as np
import cv2
import base64
from .mixer import UnifiedMixer as Mixer
from .imagemodel import ImageModel

class MixingWorker:
    def __init__(self):
        self.thread = None
        self.cancel_flag = False
        self.progress = 0
        self.result = None
        self.result_array = None  # Store numpy array
        self.is_running = False
        self.current_output_port = 1

    def start(self, images_dict, weights_a, weights_b, mode, region_config, target_output=1):
        # Cancel previous thread
        if self.thread and self.thread.is_alive():
            self.cancel_flag = True
            self.thread.join(timeout=0.1)

        # Reset
        self.cancel_flag = False
        self.progress = 0
        self.result = None
        self.result_array = None
        self.current_output_port = target_output
        self.is_running = True

        # Start new worker
        self.thread = threading.Thread(
            target=self._run,
            args=(images_dict, weights_a, weights_b, mode, region_config)
        )
        self.thread.start()

    def _run(self, images_dict, weights_a, weights_b, mode, region_config):
        try:
            # ---- STEP 1: initial progress ----
            self.progress = 10
            
            # ---- STEP 2: perform mixing (BUT IN SMALL BLOCKS) ----
            for p in range(10, 90, 10):
                if self.cancel_flag: 
                    self.is_running = False
                    return
                time.sleep(0.05)  # simulate step
                self.progress = p

            # Actual mixing - get both numpy array and base64
            if not self.cancel_flag:
                # Call Mixer.mix which should return (result_array, result_b64)
                result_array, result_b64 = Mixer.mix(
                    images_dict, weights_a, weights_b, mode, region_config
                )
                
                self.result_array = result_array
                self.result = result_b64
                
                # Create ImageModel and store in manager
                if result_array is not None:
                    # Convert numpy array to PNG bytes
                    if result_array.dtype != np.uint8:
                        # Normalize for display
                        result_array = cv2.normalize(result_array, None, 0, 255, cv2.NORM_MINMAX)
                        result_array = result_array.astype(np.uint8)
                    
                    # Encode to PNG bytes
                    _, buffer = cv2.imencode('.png', result_array)
                    image_bytes = buffer.tobytes()
                    
                    # Create ImageModel
                    output_model = ImageModel(image_bytes)
                    
                    # Store in manager
                    from .manager import manager_instance
                    output_key = f'output_{self.current_output_port}'
                    manager_instance.store_output(output_key, output_model)

            # ---- DONE ----
            self.progress = 100
            self.is_running = False

        except Exception as e:
            self.result = None
            self.result_array = None
            self.is_running = False
            print("Mixing error:", e)

    def get_status(self):
        return {
            "running": self.is_running,
            "progress": self.progress,
            "result": self.result
        }

# Singleton worker
mixing_worker = MixingWorker()