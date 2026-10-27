
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return jsonify({
        "project": "TrustLens",
        "message": "Backend is running successfully!"
    })

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "message": "TrustLens API is ready"
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)
