import json
import os
from flask import Blueprint, request, jsonify, render_template
from .manager import ImageManager
from .mixer import UnifiedMixer
from .mixing_worker import MixingWorker
import base64
import io
from PIL import Image
import numpy as np
import cv2
from .imagemodel import ImageModel 

bp = Blueprint('main', __name__)

# Get singleton instances
manager = ImageManager.get_instance()
mixing_worker = MixingWorker.get_instance()

@bp.route('/')
def index():
    return render_template('index.html')

@bp.route('/ft-mixer')
def ft_mixer():
    return render_template('ft-mixer.html')

@bp.route('/beamforming')
def beamforming():
    return render_template('beamforming.html')

# ---------------------- IMAGE UPLOAD ----------------------
@bp.route('/upload', methods=['POST'])
def upload():
    slot = request.form.get('slot_id')
    file = request.files['image']
    if file:
        # Use the upload_image method which now returns an ImageModel
        manager.upload_image(slot, file.read())
        return jsonify({'msg': 'success'})
    return jsonify({'msg': 'failed'}), 400

# ---------------------- START MIXING ----------------------
# In routes.py, update the mix route:
@bp.route('/mix', methods=['POST'])
def mix():
    data = request.json
    print(f"Mixing request data: {data}")

    # Parse sliders
    wa = {}
    wb = {}
    for key, value in data.items():
        if key.startswith('wa') and key[-1].isdigit():
            wa[key[-1]] = float(value)
        elif key.startswith('wb') and key[-1].isdigit():
            wb[key[-1]] = float(value)
    
    # Get mixing mode (basic or region)
    mixing_mode = data.get('mixing_mode', 'basic')
    
    # Get component mode (magnitude_phase or real_imag)
    component_mode = data.get('mode', 'magnitude_phase')
    
    # Get target output port
    target_output = data.get('target_output', 1)
    
    # Get regions data
    regions_data = data.get('regions', {})
    
    # Convert to backend-compatible region format
    if mixing_mode == 'basic':
        # Basic mode: use full region (100%) inner for all
        region_config = {
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
        # Region mode: use user-defined regions
        region_config = {
            'size': 100,
            'inner': True,
            'regions': {}
        }
        
        for slot in ['1', '2', '3', '4']:
            if slot in regions_data:
                region = regions_data[slot]
                region_config['regions'][slot] = {
                    'type': region.get('type', 'inner'),
                    'x': float(region.get('x', 0)),
                    'y': float(region.get('y', 0)),
                    'width': float(region.get('width', 100)),
                    'height': float(region.get('height', 100))
                }
            else:
                region_config['regions'][slot] = {
                    'type': 'inner',
                    'x': 0,
                    'y': 0,
                    'width': 100,
                    'height': 100
                }

    print(f"Processed region config: {region_config}")

    # Start async mixing
    try:
        # Get ALL images (including None values) using the original method
        # The mixer needs all slots, even if they're None
        all_images = manager.get_all_inputs()
        
        # Debug logging
        image_count = sum(1 for img in all_images.values() if img is not None)
        print(f"Starting mix with {image_count} images")
        print(f"Weights A: {wa}")
        print(f"Weights B: {wb}")
        print(f"Mode: {component_mode}")
        print(f"Target output: {target_output}")
        
        # Start the worker
        mixing_worker.start(
            all_images,  # Pass all images, including None values
            wa,
            wb,
            component_mode,
            region_config,
            target_output
        )
        return jsonify({"status": "mix_started"})
    except Exception as e:
        print(f"Error starting mix: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ---------------------- MIXING STATUS ----------------------
# Update the mix_status route in routes.py:
@bp.route('/mix_status', methods=['GET'])
def mix_status():
    """Frontend polls this every 200ms."""
    status = mixing_worker.get_status()
    # Format status to match expected frontend format
    formatted_status = {
        "running": status["running"],
        "progress": status["progress"],
        "result": status.get("result")  # Return the actual result
    }
    return jsonify(formatted_status)

# ---------------------- UPDATE GET_VIEW FOR EMPTY RESPONSES ----------------------
@bp.route('/get_view', methods=['POST'])
def get_view():
    data = request.json
    slot = str(data.get('slot_id'))
    view_type = data.get('type')
    is_output = data.get('is_output', False)

    if is_output:
        # Handle output ports
        output_key = f'output_{slot}'
        output_model = manager.get_output_image(output_key)
        
        if not output_model:
            # Return empty string for non-existent outputs
            return jsonify({'image': ''})
        
        try:
            b64 = output_model.get_encoded_view(view_type)
            return jsonify({'image': b64})
        except Exception as e:
            print(f"Error getting output view for {output_key}, type {view_type}: {e}")
            return jsonify({'image': ''})
    else:
        # Handle input images
        img = manager.get_input_image(slot)
        if not img:
            # For empty input slots, return 404
            return jsonify({'error': 'Empty'}), 404
        
        try:
            b64 = img.get_encoded_view(view_type)
            return jsonify({'image': b64})
        except Exception as e:
            print(f"Error getting input view for slot {slot}, type {view_type}: {e}")
            return jsonify({'error': str(e)}), 500
 # ---------------------- CLEAR IMAGES ----------------------
@bp.route("/reset", methods=["POST"])
def reset():
    """Clear all images."""
    manager.clear_all()
    mixing_worker.clear_results()
    return "", 204

#----------------------------BEAMFORMING------------------------------
from beam_models.phased_array import PhasedArray, LinearGeometry, CurvilinearGeometry
from beam_models.beam_viewer import BeamViewer


phased_array = PhasedArray()
beam_viewer = BeamViewer()

# -------------------------------
# GET current phased array
# -------------------------------
@bp.route('/phased_array', methods=['GET'])
def get_phased_array():
    return jsonify(phased_array.to_dict())

# -------------------------------
# Update frequency
# -------------------------------
@bp.route('/update_frequency', methods=['POST'])
def update_frequency():
    data = request.json
    phased_array.current_frequency = data.get('frequency', 1)
    return jsonify({'success': True})

# -------------------------------
# Update phase shift
# -------------------------------
@bp.route('/update_phase_shift', methods=['POST'])
def update_phase_shift():
    data = request.json
    phased_array.phase_shift = data.get('phase_shift', 0)
    return jsonify({'success': True})

# Update geometry
@bp.route('/update_geometry', methods=['POST'])
def update_geometry():
    data = request.json
    geometry = data.get('geometry', 'Linear')
    if geometry == "Linear":
        phased_array.geometry_strategy = LinearGeometry()
    else:
        phased_array.geometry_strategy = CurvilinearGeometry()
    return jsonify({'success': True})

# Update distance
@bp.route('/update_distance', methods=['POST'])
def update_distance():
    data = request.json
    phased_array.distance = data.get('distance', 1)  # auto updates positions
    return jsonify({'success': True})

# Update radius
@bp.route('/update_radius', methods=['POST'])
def update_radius():
    data = request.json
    phased_array.radius = data.get('radius', 1)  # auto updates positions
    return jsonify({'success': True})

# -------------------------------
# Add/remove transmitter
# -------------------------------
@bp.route('/add_transmitter', methods=['POST'])
def add_transmitter():
    phased_array.add_transmitter()
    return jsonify({'success': True, 'count': len(phased_array.transmitters)})

@bp.route('/remove_transmitter', methods=['POST'])
def remove_transmitter():
    phased_array.remove_transmitter()
    return jsonify({'success': True, 'count': len(phased_array.transmitters)})

# -------------------------------
# Wave map
# -------------------------------
@bp.route('/wave_map', methods=['GET'])
def get_wave_map():
    if len(phased_array.transmitters) == 0:
        return jsonify({'image': '', 'transmitter_positions': []})
    wave_map = phased_array.generate_wave_map()
    image = beam_viewer.generate_wave_map_image(wave_map)
    positions = phased_array.get_transmitter_positions()
    return jsonify({'image': image, 'transmitter_positions': positions})

# -------------------------------
# Beam profile
# -------------------------------
@bp.route('/beam_profile', methods=['GET'])
def get_beam_profile():
    angles, response = phased_array.calculate_beam_profile()
    image = beam_viewer.generate_beam_profile_image(angles, response)
    return jsonify({'image': image, 'angles': angles, 'response': response})

# -------------------------------
# Load scenario
# -------------------------------
@bp.route('/load_scenario', methods=['POST'])
def load_scenario():
    data = request.json
    scenario = data.get('scenario', 'custom')

   # Clear all existing transmitters
    while len(phased_array.transmitters) > 1:
        phased_array.remove_transmitter()

    # Reset phase shift
    phased_array.phase_shift = 0

    if scenario == 'tumor_ablation':
        phased_array.geometry_strategy = CurvilinearGeometry()
        phased_array.radius = 10
        phased_array.distance = 0.5
        phased_array.current_frequency = 1

        for _ in range(15):
            phased_array.add_transmitter()

    elif scenario == 'ultrasound':
        phased_array.geometry_strategy = LinearGeometry()
        phased_array.distance = 0.5
        phased_array.current_frequency = 1

        for _ in range(3):
            phased_array.add_transmitter()

    elif scenario == '5g_mmwave_beamforming':
        phased_array.geometry_strategy = LinearGeometry()
        phased_array.current_frequency = 28
        phased_array.distance = 0.25
        phased_array.phase_shift = 0.8

        for _ in range(31):
            phased_array.add_transmitter()

    else:  # custom
        phased_array.geometry_strategy = LinearGeometry()
        phased_array.distance = 0.5
        phased_array.current_frequency = 1
        

    # Return friendly geometry name
    geometry_name = "Linear" if isinstance(phased_array.geometry_strategy, LinearGeometry) else "Curvilinear"

    return jsonify({
        'success': True,
        'geometry': geometry_name
        
    })
