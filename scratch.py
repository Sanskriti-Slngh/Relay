
import matplotlib.pyplot as plt

labels = ["Without statins", "With statins", "Target LDL"]
values = [160, 80, 55]  # Example values, not patient data

plt.figure(figsize=(9, 5))
bars = plt.bar(
    labels, values,
    color=["#c65c56", "#e3a64a", "#4c9a84"]
)

for bar, value in zip(bars, values):
    plt.text(
        bar.get_x() + bar.get_width()/2,
        value + 3,
        f"{value} mg/dL",
        ha="center"
    )

plt.axhline(55, color="green", linestyle="--")
plt.ylabel("LDL cholesterol (mg/dL)")
plt.title("LDL Cholesterol Before and After Statin Treatment")
plt.ylim(0, 190)
plt.tight_layout()
plt.savefig("ldl_figure.png", dpi=300)
plt.show()
