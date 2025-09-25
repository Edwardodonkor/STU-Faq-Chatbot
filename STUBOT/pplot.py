
audio = "/home/ocansey/Documents/University-FAQ-Chatbot/back/static/audio/user_voice_20250924163131158308.wav"

# # Digital Samples Only

# import numpy as np
# import matplotlib.pyplot as plt
# from scipy.io import wavfile

# # Load your speech audio file
# fs, data = wavfile.read(audio)

# # Use only the first channel if stereo
# if data.ndim > 1:
#     data = data[:, 0]

# # Normalize
# data = data / np.max(np.abs(data))

# # Create a small segment (first 20ms for clarity)
# duration = 0.02  # 20ms
# samples = int(fs * duration)
# t = np.linspace(0, duration, samples, endpoint=False)

# segment = data[:samples]

# # Plot only digital samples
# plt.figure(figsize=(10,5))
# plt.stem(t*1000, segment, markerfmt="ro", basefmt=" ")
# plt.xlabel("Time (ms)")
# plt.ylabel("Amplitude")
# plt.title("Digital Speech Samples x[n]")
# plt.grid(True)
# plt.show()


import numpy as np
import matplotlib.pyplot as plt
from scipy.io import wavfile

# Load your speech audio file
fs, data = wavfile.read(audio)

# Use only the first channel if stereo
if data.ndim > 1:
    data = data[:, 0]

# Normalize
data = data / np.max(np.abs(data))

# Create a small segment (first 20ms for clarity)
duration = 0.02  # 20ms
samples = int(fs * duration)
t = np.linspace(0, duration, samples, endpoint=False)

segment = data[:samples]

# Plot continuous-like (line) and digital samples (dots)
plt.figure(figsize=(10,5))
plt.plot(t*1000, segment, color="blue", label="Speech waveform x(t)")
plt.stem(t*1000, segment, markerfmt="ro", basefmt=" ", label="Digital samples x[n]")
plt.xlabel("Time (ms)")
plt.ylabel("Amplitude")
plt.title("Analog Speech Signal vs Digital Samples")
plt.legend()
plt.grid(True)
plt.show()
