import json
import os
from flask import Blueprint, request, jsonify, render_template
from .manager import manager_instance
from .mixer import UnifiedMixer
from .mixing_worker import mixing_worker
import base64
import io
from PIL import Image
import numpy as np
import cv2
from .imagemodel import ImageModel 
bp = Blueprint('main', __name__)

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
        manager_instance.upload_image(slot, file.read())
        return jsonify({'msg': 'success'})
    return jsonify({'msg': 'failed'}), 400

# ---------------------- START MIXING ----------------------
# In your /mix route:
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
        # Default to full region if not specified
        default_region = {'x': 0, 'y': 0, 'width': 100, 'height': 100, 'type': 'inner'}
        region_config = {
            'size': 100,  # Not used in region mode
            'inner': True,  # Not used in region mode
            'regions': {}
        }
        
        for slot in ['1', '2', '3', '4']:
            if slot in regions_data:
                region = regions_data[slot]
                region_config['regions'][slot] = {
                    'type': region.get('type', 'inner'),  # CRITICAL: Include type!
                    'x': float(region.get('x', 0)),
                    'y': float(region.get('y', 0)),
                    'width': float(region.get('width', 100)),
                    'height': float(region.get('height', 100))
                }
            else:
                region_config['regions'][slot] = default_region

    print(f"Processed region config: {region_config}")

    # Start async mixing
    try:
        mixing_worker.start(
            manager_instance.get_all(),
            wa,
            wb,
            component_mode,
            region_config,
            target_output
        )
        return jsonify({"status": "mix_started"})
    except Exception as e:
        print(f"Error starting mix: {e}")
        return jsonify({"error": str(e)}), 500
    
# ---------------------- MIXING STATUS ----------------------
@bp.route('/mix_status', methods=['GET'])
def mix_status():
    """Frontend polls this every 200ms."""
    return jsonify(mixing_worker.get_status())

# ---------------------- CLEAR ALL IMAGES ----------------------
@bp.route('/clear_all', methods=['POST'])
def clear_all():
    """Clear all images from the manager"""
    try:
        print("Clearing all images from manager...")
        
        # Clear all input slots
        for slot_id in ['1', '2', '3', '4']:
            manager_instance.images[slot_id] = None
        
        # Clear all outputs
        manager_instance.outputs = { 'output_1': None, 'output_2': None }
        
        # Clear mixing worker if it exists
        try:
            mixing_worker.clear()
        except:
            pass  # Ignore if mixing_worker doesn't have clear method
        
        print("All images cleared successfully")
        return jsonify({'msg': 'All images cleared successfully'})
    except Exception as e:
        print(f"Error clearing all images: {e}")
        return jsonify({'error': str(e)}), 500

# ---------------------- CLEAR INPUT SLOT ----------------------
@bp.route('/clear_input/<slot_id>', methods=['POST'])
def clear_input(slot_id):
    """Clear a specific input slot"""
    try:
        if slot_id in manager_instance.images:
            manager_instance.images[slot_id] = None
            print(f"Input slot {slot_id} cleared")
            return jsonify({'msg': f'Input slot {slot_id} cleared'})
        else:
            return jsonify({'error': f'Invalid slot_id: {slot_id}'}), 400
    except Exception as e:
        print(f"Error clearing input slot {slot_id}: {e}")
        return jsonify({'error': str(e)}), 500

# ---------------------- CLEAR OUTPUT ----------------------
@bp.route('/clear_output/<output_port>', methods=['POST'])
def clear_output(output_port):
    """Clear a specific output port"""
    try:
        output_key = f'output_{output_port}'
        if output_key in manager_instance.outputs:
            manager_instance.outputs[output_key] = None
            print(f"Output {output_port} cleared")
            return jsonify({'msg': f'Output {output_port} cleared'})
        else:
            return jsonify({'error': f'Invalid output_port: {output_port}'}), 400
    except Exception as e:
        print(f"Error clearing output {output_port}: {e}")
        return jsonify({'error': str(e)}), 500

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
        output_model = manager_instance.get_output(output_key)
        
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
        img = manager_instance.get_image(slot)
        if not img:
            # For empty input slots, return 404
            return jsonify({'error': 'Empty'}), 404
        
        try:
            b64 = img.get_encoded_view(view_type)
            return jsonify({'image': b64})
        except Exception as e:
            print(f"Error getting input view for slot {slot}, type {view_type}: {e}")
            return jsonify({'error': str(e)}), 500
        

#----------------------------RESET IMAGING------------------------------
@bp.route("/reset", methods=["POST"])
def reset():
    manager_instance.clear_all_inputs()
    manager_instance.clear_all_outputs()
    return "", 204
   

#----------------------------BEAMFORMING------------------------------

from beam_models.phased_array import PhasedArray
from beam_models.beam_viewer import BeamViewer



# Shared instances
phased_array = PhasedArray()
beam_viewer = BeamViewer()



@bp.route('/phased_array', methods=['GET'])
def get_phased_array():
    return jsonify(phased_array.to_dict())


@bp.route('/update_frequency', methods=['POST'])
def update_frequency():
    data = request.json
    phased_array.current_frequency = data.get('frequency', 1)
    return jsonify({'success': True})


@bp.route('/update_phase_shift', methods=['POST'])
def update_phase_shift():
    data = request.json
    phased_array.phase_shift = data.get('phase_shift', 0)
    return jsonify({'success': True})


@bp.route('/update_geometry', methods=['POST'])
def update_geometry():
    data = request.json
    geometry = data.get('geometry', 'Linear')
    phased_array.geometry = geometry

    if geometry == "Linear":
        phased_array.calculate_linear_distance(phased_array.distance)
    else:
        phased_array.calculate_angles(phased_array.distance, phased_array.radius)

    return jsonify({'success': True})


@bp.route('/update_distance', methods=['POST'])
def update_distance():
    data = request.json
    phased_array.distance = data.get('distance', 1)

    if phased_array.geometry == "Linear":
        phased_array.calculate_linear_distance(phased_array.distance)
    else:
        phased_array.calculate_angles(phased_array.distance, phased_array.radius)

    return jsonify({'success': True})


@bp.route('/update_radius', methods=['POST'])
def update_radius():
    data = request.json
    phased_array.radius = data.get('radius', 1)

    if phased_array.geometry == "Curvilinear":
        phased_array.calculate_angles(phased_array.distance, phased_array.radius)

    return jsonify({'success': True})


@bp.route('/add_transmitter', methods=['POST'])
def add_transmitter():
    data = request.json
    phased_array.add_transmitter(
        data.get('distance', 1),
        data.get('radius', 1)
    )
    return jsonify({'success': True, 'count': len(phased_array.transmitters)})


@bp.route('/remove_transmitter', methods=['POST'])
def remove_transmitter():
    data = request.json
    phased_array.remove_transmitter(
        data.get('distance', 1),
        data.get('radius', 1)
    )
    return jsonify({'success': True, 'count': len(phased_array.transmitters)})


@bp.route('/wave_map', methods=['GET'])
def get_wave_map():
    wave_map = phased_array.generate_wave_map()
    image = beam_viewer.generate_wave_map_image(wave_map)
    positions = phased_array.get_transmitter_positions()

    return jsonify({
        'image': image,
        'transmitter_positions': positions
    })


@bp.route('/beam_profile', methods=['GET'])
def get_beam_profile():
    angles, response = phased_array.calculate_beam_profile()
    image = beam_viewer.generate_beam_profile_image(angles, response)

    return jsonify({
        'image': image,
        'angles': angles,
        'response': response
    })


@bp.route('/load_scenario', methods=['POST'])
def load_scenario():
    data = request.json
    scenario = data.get('scenario', 'custom')

    phased_array.transmitters = []
    phased_array.phase_shift = 0

    if scenario == 'tumor_ablation':
        phased_array.geometry = "Curvilinear"
        phased_array.radius = 10
        phased_array.distance = 0.5
        phased_array.current_frequency = 1

        for _ in range(16):
            phased_array.add_transmitter(0.5, 10)

    elif scenario == 'ultrasound':
        phased_array.geometry = "Linear"
        phased_array.distance = 0.5
        phased_array.current_frequency = 1

        for _ in range(4):
            phased_array.add_transmitter(0.5, 0)

    elif scenario == '5g_mmwave_beamforming':
        phased_array.geometry = "Linear"
        phased_array.current_frequency = 28
        phased_array.distance = 0.25
        phased_array.phase_shift = 0.8

        for _ in range(32):
            phased_array.add_transmitter(0.25, 0)

    else:  # custom
        phased_array.geometry = "Linear"
        phased_array.distance = 0.5
        phased_array.current_frequency = 1
        phased_array.add_transmitter(0.5, 0)

    return jsonify({'success': True})