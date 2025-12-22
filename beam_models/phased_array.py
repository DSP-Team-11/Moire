import numpy as np
from typing import List
from .transmitter import Transmitter

# =========================================================
# Geometry Strategy (Abstraction)
# =========================================================
class GeometryStrategy:
    """Abstract base class for array geometry"""
    def calculate_positions(self, transmitters, distance, radius):
        raise NotImplementedError("Must be implemented by subclass")

# =========================================================
# Linear Geometry
# =========================================================
class LinearGeometry(GeometryStrategy):
    """Linear phased array geometry"""
    def calculate_positions(self, transmitters, distance, radius):
        n = len(transmitters)
        start_x = -(n - 1) / 2 * distance
        for i, t in enumerate(transmitters):
            t.x_position = start_x + i * distance
            t.y_position = 0.0

# =========================================================
# Curvilinear Geometry
# =========================================================
class CurvilinearGeometry(GeometryStrategy):
    """Curved phased array geometry"""
    def calculate_positions(self, transmitters, distance, radius):
        n = len(transmitters)
        if n == 1:
            transmitters[0].x_position = 0
            transmitters[0].y_position = radius
            return
        delta_theta = distance / radius
        total_angle = delta_theta * (n - 1)
        angles = np.linspace(-total_angle / 2, total_angle / 2, n)
        for i, t in enumerate(transmitters):
            t.x_position = radius * np.cos(angles[i])
            t.y_position = radius * np.sin(angles[i]) + radius

# =========================================================
# Phased Array with Properties
# =========================================================
class PhasedArray:
    """Manages transmitters, geometry, beamforming, wave calculations"""
    def __init__(self, geometry_strategy=None):
        self._geometry_strategy = geometry_strategy or LinearGeometry()
        self._transmitters: List[Transmitter] = [Transmitter()]
        self._current_frequency = 1.0
        self._phase_shift = 0.0
        self._distance = 1.0
        self._radius = 5.0

        self._current_x_range = 20
        self._current_y_range = 20
        self._x_grid_size = 800
        self._y_grid_size = 800
        self._wave_map = np.zeros((self._y_grid_size, self._x_grid_size))

        self.update_positions()

    # -------------------------------
    # Properties
    # -------------------------------
    @property
    def geometry_strategy(self):
        return self._geometry_strategy

    @geometry_strategy.setter
    def geometry_strategy(self, strategy):
        self._geometry_strategy = strategy
        self.update_positions()

    @property
    def transmitters(self):
        return self._transmitters

    @property
    def current_frequency(self):
        return self._current_frequency

    @current_frequency.setter
    def current_frequency(self, value):
        self._current_frequency = value

    @property
    def phase_shift(self):
        return self._phase_shift

    @phase_shift.setter
    def phase_shift(self, value):
        self._phase_shift = value

    @property
    def distance(self):
        return self._distance

    @distance.setter
    def distance(self, value):
        self._distance = value
        self.update_positions()

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        self._radius = value
        self.update_positions()

    @property
    def wave_map(self):
        return self._wave_map

    # -------------------------------
    # Geometry Handling
    # -------------------------------
    def update_positions(self):
        self._geometry_strategy.calculate_positions(
            self._transmitters,
            self._distance,
            self._radius
        )

    # -------------------------------
    # Transmitter Management
    # -------------------------------
    def add_transmitter(self):
        self._transmitters.append(Transmitter())
        self.update_positions()

    def remove_transmitter(self):
        if len(self._transmitters) > 1:
            self._transmitters.pop()
            self.update_positions()

    # -------------------------------
    # Wave Physics
    # -------------------------------
    def calculate_wave_number(self):
        return 2 * np.pi * self._current_frequency

    def generate_wave_map(self):
        x = np.linspace(-self._current_x_range, self._current_x_range, self._x_grid_size)
        y = np.linspace(0, self._current_y_range, self._y_grid_size)
        X, Y = np.meshgrid(x, y)
        amplitude = np.zeros_like(X)
        k = self.calculate_wave_number()
        for i, t in enumerate(self._transmitters):
            r = np.sqrt((X - t.x_position) ** 2 + (Y - t.y_position) ** 2)
            amplitude += np.sin(k * r + i * self._phase_shift)
        amplitude -= amplitude.min()
        max_val = amplitude.max()
        if max_val != 0:
            amplitude /= max_val
        self._wave_map = amplitude
        return amplitude

    # -------------------------------
    # Beam Profile
    # -------------------------------
    def calculate_beam_profile(self):
        angles = np.linspace(0, 2 * np.pi, 1000)
        k = self.calculate_wave_number()
        response = []
        for theta in angles:
            phases = []
            for i, t in enumerate(self._transmitters):
                delta_r = t.x_position * np.sin(theta) + t.y_position * np.cos(theta)
                phases.append(k * delta_r - i * self._phase_shift)
            array_response = np.sum(np.exp(1j * np.array(phases)))
            response.append(abs(array_response))
        response = np.array(response)
        max_resp = response.max()
        if max_resp != 0:
            response /= max_resp
        return angles.tolist(), response.tolist()

    # -------------------------------
    # Utilities
    # -------------------------------
    def to_dict(self):
        return {
            "current_frequency": self._current_frequency,
            "phase_shift": self._phase_shift,
            "distance": self._distance,
            "radius": self._radius,
            "geometry": self._geometry_strategy.__class__.__name__,
            "transmitter_count": len(self._transmitters),
            "transmitters": [t.to_dict() for t in self._transmitters]
        }

    def get_transmitter_positions(self):
        return [t.to_dict() for t in self._transmitters]
