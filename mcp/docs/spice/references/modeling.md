# Models, testbenches and convergence

Start with meaningful supplies, source impedance, output loads and signal range. Check whether the selected model covers the requested phenomenon (DC, switching, noise, startup, saturation). A generic diode or ideal amplifier cannot validate a specific manufacturer's full behavior.

For pin assignment, comments and documented port functions take precedence. `.SUBCKT` declares call order, which can differ from physical package pins. Do not silently guess power polarity or swap ports until a simulation happens to run.

## Convergence recovery

Preserve each attempt in its own circuit/result directory. Fix topology and modeling mistakes before relaxing numerical accuracy:

1. Inspect diagnostics, unconnected ports, missing ground, supply polarity, invalid parameters, floating nodes and ideal voltage-source/inductor loops. Verify DC paths and try an operating point when appropriate.
2. Inspect the input stimulus and transient maximum timestep. Use realistic finite rise/fall times. `.nodeset` can guide the operating-point solver when a justified approximate value is known. `.ic` and `uic` change startup assumptions; do not enable `uic` globally.
3. Increase relevant iteration limits or try a documented numerical method, for example `.options itl1=500 itl4=100` or `.options method=gear`. Gear can damp numerical ringing and also change apparent oscillatory behavior. Keep all adjustments visible in the circuit. Avoid blanket loosening of tolerances.
4. Add justified nonidealities where needed: winding resistance, capacitor ESR, source resistance, or a high-value leakage resistor providing a DC path for an otherwise floating node. Choose magnitudes relative to circuit impedance and relevant timescales; there is no universal correct shunt resistor or capacitance.
5. Repeat with smaller artificial perturbations or tighter settings to establish whether the measured result changes materially. A result that depends on the convergence aid must be described as such.

Do not add capacitors everywhere to force success: they may suppress the instability being investigated. Global `rshunt`/`cshunt` can perturb many nodes; prefer targeted components and record their purpose. The runner deliberately does not edit circuit topology or retry with hidden settings.

For parameter sweeps or Monte Carlo, generate explicit circuit variants with a recorded seed and stated distributions/tolerances. Random samples do not establish worst-case bounds. Keep each run's outputs separate and compare the relevant measurements.
