import matplotlib.pyplot as plt

# Example accuracy results
labels = ["Correct Responses", "Incorrect Responses"]
sizes = [85, 15]  # Replace with your data
colors = ["lightgreen", "lightcoral"]

plt.figure(figsize=(6, 6))
plt.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=140)
plt.title("Response Accuracy Distribution")
plt.show()
