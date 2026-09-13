"""Length utilities. Observed API scales require a basic check on each new editor version."""
import math
from types import MappingProxyType

OBSERVED_PCB_UNITS = MappingProxyType({'primitive_mm_per_unit': .0254, 'poured_mm_per_unit': .254})

def _finite(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{name} must be a finite number')
    return value

def convert_length(value, source_mm_per_unit, target_mm_per_unit=1):
    """Lengths only: polygon arrays also contain angles and command parameters."""
    _finite(value, 'value'); _finite(source_mm_per_unit, 'source_mm_per_unit'); _finite(target_mm_per_unit, 'target_mm_per_unit')
    if source_mm_per_unit <= 0 or target_mm_per_unit <= 0:
        raise ValueError('Unit scales must be positive')
    return _finite(value * source_mm_per_unit / target_mm_per_unit, 'converted length')

def mil_to_mm(value): return convert_length(value, .0254)
def mm_to_mil(value): return convert_length(value, 1, .0254)

def assert_unit_scale(native_distance, reference_mm, mm_per_unit, tolerance_mm):
    """Reference length must be independently known; this does not query or modify the editor."""
    _finite(native_distance, 'native_distance'); _finite(reference_mm, 'reference_mm'); _finite(tolerance_mm, 'tolerance_mm')
    if native_distance <= 0 or reference_mm <= 0 or tolerance_mm < 0 or tolerance_mm >= reference_mm / 2:
        raise ValueError('Use positive distances and a meaningful nonnegative tolerance')
    actual = convert_length(native_distance, mm_per_unit)
    if abs(actual-reference_mm) > tolerance_mm:
        raise ValueError(f'Unit scale mismatch: observed {actual} mm; expected {reference_mm} ± {tolerance_mm} mm. Recheck the connected EasyEDA API.')
