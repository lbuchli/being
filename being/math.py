"""Mathematical helper functions."""
import math
from typing import Tuple, NamedTuple

from being.constants import TAU

import numpy as np
from numpy import ndarray
import scipy.optimize


def clip(number: float, lower: float, upper: float) -> float:
    """Clip `number` to the closed interval [`lower`, `upper`].

    Args:
        number: Input value.
        lower: Lower bound.
        upper: Upper bound.

    Returns:
        Clipped value.
    """
    if lower > upper:
        lower, upper = upper, lower

    return max(lower, min(number, upper))


def sign(number: float) -> float:
    """Signum function.

    Args:
        number: Input value.

    Returns:
        Sign part of the number.
    """
    return math.copysign(1., number)


def solve_quadratic_equation(a: float, b: float, c: float) -> Tuple[float, float]:
    """Both solutions of the quadratic equation a * x^2 + b * x + c = 0.

    x0, x1 = (-b +/- sqrt(b^2 - 4*a*c)) / (2 * a)

    Returns:
        tuple: Solutions.
    """
    discriminant = b**2 - 4 * a * c
    x0 = (-b + discriminant**.5) / (2 * a)
    x1 = (-b - discriminant**.5) / (2 * a)
    return x0, x1


def linear_mapping(xRange: Tuple[float, float], yRange: Tuple[float, float]) -> ndarray:
    """Get linear coefficients for y = a * x + b.

    Args:
        xRange: Input range (xmin, xmax).
        yRange: Output range (xmin, xmax).

    Returns:
        Linear coefficients [a, b].
    """
    xmin, xmax = xRange
    ymin, ymax = yRange
    return np.linalg.solve([
        [xmin, 1.],
        [xmax, 1.],
    ], [ymin, ymax])


def angular_velocity_to_rpm(angVel: float) -> float:
    """Convert angular velocity to rotations per minute.

    Args:
        angVel: Angular velocity [rad / s]

    Returns:
        Velocity in [rpm]

    """
    return angVel * 60 / TAU


def rpm_to_angular_velocity(rpm: float) -> float:
    """Convert rotations per minute to angular velocity.

    Args:
        rpm: rotation per minute [rpm]

    Returns:
        Angular velocity [rad / s]

    """
    return TAU * rpm / 60


class ArchimedeanSpiral(NamedTuple):

    """Archimedean spiral defined by:

        r(phi) = a + b * phi.
    """

    a: float
    b: float = 0.  # Trivial case circle

    def radius(self, angle: float) -> float:
        """Calculate radius of spiral for a given angle."""
        return self.a + self.b * angle

    @staticmethod
    def arc_length_helper(anlge, b):
        """Helper function for arc length calculations."""
        return b / 2 * (
            anlge * math.sqrt(1 + anlge ** 2)
            + math.log(anlge + math.sqrt(1 + anlge ** 2))
        )

    def _arc_length(self, angle: float) -> float:
        return self.arc_length_helper(angle, self.b) + self.a * angle

    def arc_length(self, endAngle: float, startAngle: float = 0) -> float:
        """Arc length of spiral from a startAngle to an endAngle."""
        return self._arc_length(endAngle) - self._arc_length(startAngle)

    @classmethod
    def fit(cls, diameter, outerDiameter, arcLength) -> tuple:
        """Args:
            diameter: Inner diameter of spiral.
            outerDiameter: Outer diameter of spiral. If equal to diameter -> Circle.
            arcLength: Measured arc length.

        Returns:
            Fitted spiral and estimated maximum angle.
        """
        if outerDiameter < diameter:
            raise ValueError('outerDiameter >= diameter!')

        a = .5 * diameter
        phi0 = arcLength / a  # Naive phi if spiral is a circle
        if diameter == outerDiameter:
            # Trivial circle case
            return ArchimedeanSpiral(a, b=0.0), phi0

        def func(x):
            b, phi = x
            return [
                a + b * phi - .5 * outerDiameter,
                cls.arc_length_helper(phi, b) + a * phi - arcLength,
            ]

        x0 = [0.0, phi0]
        bEst, phiEst = scipy.optimize.fsolve(func, x0)
        return cls(a, b=bEst), phiEst
