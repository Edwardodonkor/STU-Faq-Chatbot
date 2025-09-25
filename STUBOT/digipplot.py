audio = "/home/ocansey/Documents/University-FAQ-Chatbot/back/static/audio/user_voice_20250924171436971252.wav"

# Digital Samples Only
import numpy as np
import matplotlib.pyplot as plt
from scipy.io import wavfile

# Load WAV file correctly (use the variable audio, not the string "audio")
sample_rate, samples = wavfile.read(audio)

# Normalize samples if they are in int16 format
if samples.dtype == np.int16:
    samples = samples / (2**15)

# Take a short segment for clear visualization (e.g., first 1000 samples)
segment = samples[:1000]

# Compute discrete time indices n
n = np.arange(len(segment))
Ts = 1 / sample_rate  # Sampling interval
t = n * Ts  # Discrete time values (in seconds)

# Plot digital samples
plt.figure(figsize=(12, 6))
plt.stem(t, segment, 'r', markerfmt='ro', basefmt=" ", label=r"Digital samples $x[n] = x(nT_s)$")

plt.title("Digital Speech Signal Representation")
plt.xlabel("Time (s)")
plt.ylabel("Amplitude")
plt.legend()
plt.grid(True)
plt.show()
