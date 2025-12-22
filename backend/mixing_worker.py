# mixing_worker.py
import threading
import time
import numpy as np
import cv2
import base64
from typing import Dict, Optional, Any, Tuple
from .mixer import UnifiedMixer as Mixer
from .imagemodel import ImageModel

class MixingWorker:
    _instance = None
    
    def __init__(self):
        self._thread = None
        self._cancel_flag = False
        self._progress = 0
        self._result = None
        self._result_array = None
        self._is_running = False
        self._current_output_port = 1
        self._error_message = None
        self._mixing_start_time = None
        self._mixing_end_time = None
        
        # Callback for progress updates
        self._progress_callback = None
        self._completion_callback = None
        self._error_callback = None

    # Getter and setter methods
    def get_thread(self) -> Optional[threading.Thread]:
        return self._thread
    
    def get_cancel_flag(self) -> bool:
        return self._cancel_flag
    
    def set_cancel_flag(self, flag: bool) -> None:
        self._cancel_flag = flag
    
    def get_progress(self) -> int:
        return self._progress
    
    def set_progress(self, progress: int) -> None:
        if 0 <= progress <= 100:
            self._progress = progress
            if self._progress_callback:
                self._progress_callback(progress)
        else:
            raise ValueError("Progress must be between 0 and 100")
    
    def get_result(self) -> Optional[str]:
        return self._result
    
    def set_result(self, result: str) -> None:
        self._result = result
    
    def get_result_array(self) -> Optional[np.ndarray]:
        return self._result_array
    
    def set_result_array(self, result_array: np.ndarray) -> None:
        self._result_array = result_array
    
    def is_running(self) -> bool:
        return self._is_running
    
    def set_running(self, running: bool) -> None:
        self._is_running = running
    
    def get_current_output_port(self) -> int:
        return self._current_output_port
    
    def set_current_output_port(self, port: int) -> None:
        if 1 <= port <= 4:
            self._current_output_port = port
        else:
            raise ValueError("Output port must be between 1 and 4")
    
    def get_error_message(self) -> Optional[str]:
        return self._error_message
    
    def set_error_message(self, message: str) -> None:
        self._error_message = message
    
    def get_mixing_duration(self) -> Optional[float]:
        if self._mixing_start_time and self._mixing_end_time:
            return self._mixing_end_time - self._mixing_start_time
        return None
    
    def set_progress_callback(self, callback) -> None:
        self._progress_callback = callback
    
    def set_completion_callback(self, callback) -> None:
        self._completion_callback = callback
    
    def set_error_callback(self, callback) -> None:
        self._error_callback = callback

    def start(self, images_dict: Dict, weights_a: Dict, weights_b: Dict, 
              mode: str, region_config: Dict, target_output: int = 1) -> None:
        # Cancel previous thread if running
        if self._thread and self._thread.is_alive():
            self._cancel_flag = True
            self._thread.join(timeout=0.1)

        # Reset state
        self._cancel_flag = False
        self._progress = 0
        self._result = None
        self._result_array = None
        self._current_output_port = target_output
        self._is_running = True
        self._error_message = None
        self._mixing_start_time = time.time()
        self._mixing_end_time = None

        # Start new worker thread
        self._thread = threading.Thread(
            target=self._run,
            args=(images_dict, weights_a, weights_b, mode, region_config),
            daemon=True
        )
        self._thread.start()
    
    # In mixing_worker.py, update the _run method:

    def _run(self, images_dict: Dict, weights_a: Dict, weights_b: Dict, 
            mode: str, region_config: Dict) -> None:
        """
        Main mixing execution logic.
        """
        try:
            print(f"DEBUG: Starting mixing worker...")
            
            # Set initial progress
            self.set_progress(10)
            
            # Check if we have valid images
            valid_images = {k: v for k, v in images_dict.items() if v is not None}
            if not valid_images:
                print("DEBUG: No valid images to mix")
                self.set_result("")
                self.set_result_array(None)
                self.set_progress(100)
                self.set_running(False)
                return
            
            print(f"DEBUG: Mixing {len(valid_images)} images")
            
            # SIMULATE progress for better UX
            progress_steps = [20, 30, 40, 50, 60, 70, 80, 90]
            for progress in progress_steps:
                if self._cancel_flag:
                    self.set_running(False)
                    return
                time.sleep(0.05)
                self.set_progress(progress)
            
            # Call the mixer - IMPORTANT: Use the correct method
            print(f"DEBUG: Calling Mixer.static_mix()...")
            print(f"DEBUG: Mode: {mode}, Region config: {region_config}")
            print(f"DEBUG: Weights A: {weights_a}, Weights B: {weights_b}")
            
            result_array, result_b64 = Mixer.static_mix(
                images_dict, weights_a, weights_b, mode, region_config
            )
            
            print(f"DEBUG: Mixing complete.")
            print(f"DEBUG: Result array: {'Present' if result_array is not None else 'None'}")
            print(f"DEBUG: Result base64: {'Present' if result_b64 else 'Empty/None'}")
            if result_b64:
                print(f"DEBUG: Base64 length: {len(result_b64)}")
            
            # Always store results, even if empty
            self.set_result(result_b64 if result_b64 else "")
            self.set_result_array(result_array)
            
            # Create output model if we have results
            if result_array is not None and result_b64:
                output_model = self._create_output_model(result_array)
                
                # Store in manager
                from .manager import ImageManager
                manager = ImageManager.get_instance()
                output_key = f'output_{self._current_output_port}'
                manager.store_output(output_key, output_model)
                print(f"DEBUG: Output stored to {output_key}")
            else:
                print(f"DEBUG: No output to store - array: {result_array is not None}, b64: {bool(result_b64)}")
            
            # ALWAYS set progress to 100% when done
            self.set_progress(100)
            self._mixing_end_time = time.time()
            self.set_running(False)
            print(f"DEBUG: Worker finished successfully")
            
            if self._completion_callback:
                self._completion_callback(self._result, self._result_array)

        except Exception as e:
            print(f"ERROR in mixing worker: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Set empty result on error
            self.set_result("")
            self.set_result_array(None)
            self.set_error_message(str(e))
            self.set_running(False)
            self._mixing_end_time = time.time()
            self.set_progress(100)  # Still set to 100% even on error
            
            if self._error_callback:
                self._error_callback(str(e))

    def _create_output_model(self, result_array: np.ndarray) -> ImageModel:
        # Convert numpy array to PNG bytes
        if result_array.dtype != np.uint8:
            result_array = cv2.normalize(result_array, None, 0, 255, cv2.NORM_MINMAX)
            result_array = result_array.astype(np.uint8)
        
        # Encode to PNG bytes
        _, buffer = cv2.imencode('.png', result_array)
        image_bytes = buffer.tobytes()
        
        # Create ImageModel
        return ImageModel(image_bytes)

    def cancel(self) -> None:
        self._cancel_flag = True
        self.set_progress(0)
        self.set_running(False)
    
    def wait_for_completion(self, timeout: Optional[float] = None) -> bool:
        if self._thread:
            self._thread.join(timeout=timeout)
            return not self._thread.is_alive()
        return True
    
    def get_status(self) -> Dict[str, Any]:
        return {
            "running": self._is_running,
            "progress": self._progress,
            "result": self._result,  # Return the actual base64 string or None
            "current_output_port": self._current_output_port,
            "error": self._error_message,
            "duration": self.get_mixing_duration()
        }
    
    def clear_results(self) -> None:
        self._result = None
        self._result_array = None
        self._error_message = None
        self._progress = 0
    
    @classmethod
    def get_instance(cls) -> 'MixingWorker':
        if cls._instance is None:
            cls._instance = MixingWorker()
        return cls._instance

# Singleton worker
mixing_worker = MixingWorker.get_instance()