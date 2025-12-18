from flask import Flask, render_template
from flask_cors import CORS
from config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)
    
    # Import and register the blueprint from backend package
    from backend.routes import bp
    app.register_blueprint(bp)
    
    return app

if __name__ == '__main__':
    app = create_app()
    # threaded=True is essential for simultaneous requests (like mixing while uploading)
    app.run(debug=True, port=5000, threaded=True)