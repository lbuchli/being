"""Maxon EPOS4 motor controller definitions.
Registers are listed starting at page 66 in
# https://www.maxongroup.ch/medias/sys_master/root/8884070187038/EPOS4-Firmware-Specification-En.pdf
"""
import enum


# Manufacturer specific objects

AXIS_CONFIGURATION = 0x3000
SENSORS_CONFIGURATION = 1
CONTROL_STRUCTURE = 2
COMMUTATION_SENSORS = 3
AXIS_CONFIGURATION_MISCELLANEOUS = 4
MAIN_SENSOR_RESOLUTION = 5
MAX_SYSTEM_SPEED = 6

MOTOR_DATA_MAXON = 0x3001
NOMINAL_CURRENT = 1
OUTPUT_CURRENT_LIMIT = 2
NUMBER_OF_POLE_PAIRS = 3
THERMAL_TIME_CONSTANT_WINDING = 4
MOTOR_TORQUE_CONSTANT = 5

GEAR_CONFIGURATION = 0x3003
GEAR_REDUCTION_NUMERATOR = 1
GEAR_REDUCTION_DENOMINATOR = 2
MAX_GEAR_INPUT_SPEED = 3

DIGITAL_INCREMENTAL_ENCODER_1 = 0x3010
DIGITAL_INCREMENTAL_ENCODER_1_NUMBER_OF_PULSES = 1
DIGITAL_INCREMENTAL_ENCODER_1_TYPE = 2
DIGITAL_INCREMENTAL_ENCODER_1_INDEX_POSITION = 4

CURRENT_CONTROL_PARAMETER_SET_MAXON = 0x30A0
CURRENT_CONTROLLER_P_GAIN = 1
CURRENT_CONTROLLER_I_GAIN = 2

VELOCITY_CONTROL_PARAMETER_SET_MAXON = 0x30A2
VELOCITY_CONTROLLER_P_GAIN = 1
VELOCITY_CONTROLLER_I_GAIN = 2

HOME_OFFSET_MOVE_DISTANCE = 0x30B1

# Standardized but not available with Faulhaber

MOTOR_RATED_TORQUE = 0x6076  # Not with FH
MAX_MOTOR_SPEED = 0x6080  # Not with FH

INTERPOLATION_TIME_PERIOD = 0x60C2   # Not with FH
INTERPOLATION_TIME_PERIOD_VALUE = 1

MOTOR_TYPE = 0x6402   # Not with FH


class AxisPolarity(enum.IntEnum):

    """Axis polarity for DC motors"""
    CCW = 0
    CW = 1
