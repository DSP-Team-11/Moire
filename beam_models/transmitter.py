class Transmitter:
    """Represents a single transmitter in the phased array"""
    def __init__(self, x_position=0, y_position=0, frequency=1, phase_shift=0):
        self.x_position = x_position
        self.y_position = y_position
        self.frequency = frequency
        self.phase_shift = phase_shift

    def to_dict(self):
        return {
            'x_position': self.x_position,
            'y_position': self.y_position,
            'frequency': self.frequency,
            'phase_shift': self.phase_shift
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            x_position=data.get('x_position', 0),
            y_position=data.get('y_position', 0),
            frequency=data.get('frequency', 1),
            phase_shift=data.get('phase_shift', 0)
        )
