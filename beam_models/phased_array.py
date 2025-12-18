import numpy as np
from typing import List
from .transmitter import Transmitter

class PhasedArray:
    """Manages the phased array of transmitters with OOP encapsulation"""
    
    def __init__(self):
        self.current_frequency = 1
        self.transmitters: List[Transmitter] = [Transmitter()]
        self.phase_shift = 0
        self.geometry = "Linear"
        self.distance = 1
        self.radius = 1
        self.current_x_range = 20
        self.current_y_range = 20
        self.x_grid_size = 800
        self.y_grid_size = 800
        self.wave_map = np.zeros((800, 800))
    
    def add_transmitter(self, distance_between_transmitters, radius):
        """Add a new transmitter to the array"""
        self.transmitters.append(Transmitter())
        if self.geometry == "Linear":
            self.calculate_linear_distance(distance_between_transmitters)
        elif self.geometry == "Curvilinear":
            self.calculate_angles(distance_between_transmitters, radius)
    
    def remove_transmitter(self, distance_between_transmitters, radius):
        """Remove the last transmitter from the array"""
        if len(self.transmitters) > 0:
            self.transmitters.pop()
            
        if self.geometry == "Linear":
            self.calculate_linear_distance(distance_between_transmitters)
        elif self.geometry == "Curvilinear":
            self.calculate_angles(distance_between_transmitters, radius)
    
    def calculate_linear_distance(self, distance_between_transmitters):
        """Calculate positions for linear geometry"""
        transmitters_number = len(self.transmitters)
        start_x_position = -(transmitters_number - 1) / 2 * distance_between_transmitters
        
        for trans_num, transmitter in enumerate(self.transmitters):
            transmitter.x_position = start_x_position + trans_num * distance_between_transmitters
            transmitter.y_position = 0
    
    def calculate_angles(self, arc_distance_between_transmitters, radius):
        """Calculate positions for curvilinear geometry"""
        transmitters_number = len(self.transmitters)
        delta_theta = arc_distance_between_transmitters / radius
        total_angle = delta_theta * (transmitters_number - 1)
        angles_between_transmitters = np.linspace(-total_angle/2, total_angle/2, transmitters_number)
        
        for trans_num, transmitter in enumerate(self.transmitters):
            transmitter.x_position = radius * np.cos(angles_between_transmitters[trans_num])
            transmitter.y_position = radius * np.sin(angles_between_transmitters[trans_num]) + radius
    
    def generate_wave_map(self):
        """Generate the wave interference pattern"""
        x_line = np.linspace(-self.current_y_range, self.current_x_range, self.x_grid_size)
        y_line = np.linspace(0, self.current_y_range, self.y_grid_size)
        x_mesh, y_mesh = np.meshgrid(x_line, y_line)
        amplitude = np.zeros_like(x_mesh)
        
        for i, transmitter in enumerate(self.transmitters):
            distance = np.sqrt((x_mesh - transmitter.x_position)**2 + 
                             (y_mesh - transmitter.y_position)**2)
            amplitude += np.sin(
                self.current_frequency * 2 * np.pi + 
                i * self.phase_shift + 
                2 * np.pi * self.current_frequency * distance
            )
        
        # Normalize amplitude
        amplitude_normalized = (amplitude - np.min(amplitude)) / (np.max(amplitude) - np.min(amplitude))
        self.wave_map = amplitude_normalized
        
        return amplitude_normalized
    
    def calculate_beam_profile(self):
        """Calculate the beam profile for polar plot"""
        angles = np.linspace(0, 2 * np.pi, 1000)
        
        if self.geometry == "Linear":
            return self._calculate_linear_beam_profile(angles)
        else:  # Curvilinear
            return self._calculate_curvilinear_beam_profile(angles)

    def _calculate_linear_beam_profile(self, angles):
        """Calculate beam profile for linear array"""
        k = 2 * np.pi / (1 / self.current_frequency)
        
        if len(self.transmitters) > 1:
            distance_between = abs(self.transmitters[0].x_position - 
                                self.transmitters[1].x_position)
        else:
            distance_between = 0
        
        response = []
        for theta in angles:
            phase_shifts = k * np.arange(len(self.transmitters)) * \
                        distance_between * np.sin(theta) - \
                        np.arange(len(self.transmitters)) * (self.phase_shift)
            array_response = np.sum(np.exp(1j * phase_shifts))
            response.append(abs(array_response))
        
        response = np.array(response)
        if np.max(response) > 0:
            response = response / np.max(response)
        
        return angles.tolist(), response.tolist()

    def _calculate_curvilinear_beam_profile(self, angles):
        """Calculate beam profile for curvilinear array"""
        k = 2 * np.pi / (1 / self.current_frequency)
        
        response = []
        for theta in angles:
            phase_shifts = []
            for i, transmitter in enumerate(self.transmitters):
                delta_r = transmitter.x_position * np.sin(theta) + \
                transmitter.y_position * np.cos(theta)

                phase_shift = k * delta_r - self.phase_shift * i
                phase_shifts.append(phase_shift)
            
            array_response = np.sum(np.exp(1j * np.array(phase_shifts)))
            response.append(abs(array_response))
        
        response = np.array(response)
        if np.max(response) > 0:
            response = response / np.max(response)
        
        return angles.tolist(), response.tolist()
    def get_transmitter_positions(self):
        """Get scaled transmitter positions for visualization"""
        positions = []
        for transmitter in self.transmitters:
            scaled_x = (transmitter.x_position * (self.x_grid_size/2) / 
                       self.current_x_range) + self.x_grid_size/2
            scaled_y = (transmitter.y_position * self.y_grid_size / 
                       self.current_y_range)
            positions.append({'x': scaled_x, 'y': scaled_y})
        return positions
    
    def to_dict(self):
        """Convert phased array to dictionary for JSON serialization"""
        return {
            'current_frequency': self.current_frequency,
            'phase_shift': self.phase_shift,
            'geometry': self.geometry,
            'distance': self.distance,
            'radius': self.radius,
            'transmitters': [t.to_dict() for t in self.transmitters],
            'transmitter_count': len(self.transmitters)
        }