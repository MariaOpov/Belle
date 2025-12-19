import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
// Thay đổi cách import để tránh lỗi build
import { Live2DModel } from 'pixi-live2d-display/cubism4';

// Đăng ký PIXI
window.PIXI = PIXI;

// --- CẬP NHẬT ĐƯỜNG DẪN ĐẾN FILE CỦA BELLE ---
const MODEL_URL = '/live2d/zzz_belle/zzz_belle.model3.json';

export default function Live2DAvatar() {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const [modelError, setModelError] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Khởi tạo Pixi App (v6)
    if (!appRef.current) {
      console.log("🚀 Init Pixi App v6 for Belle...");
      appRef.current = new PIXI.Application({
        view: canvas,
        autoStart: true,
        transparent: true, 
        resizeTo: canvas.parentElement, 
      });
    }

    const app = appRef.current;

    // 2. Hàm tải model
    const loadModel = async () => {
      try {
        console.log("Đang tải Belle từ:", MODEL_URL);
        const model = await Live2DModel.from(MODEL_URL);

        if (!app || !app.stage) return;

        app.stage.removeChildren();

        // --- CẤU HÌNH VỊ TRÍ & KÍCH THƯỚC (IMMERSIVE MODE) ---
        
        // Tăng scale lên một chút vì khung chat bây giờ to hơn
        model.scale.set(0.15); 

        // Căn giữa màn hình dựa trên kích thước thực tế của App
        model.x = app.screen.width / 2;
        
        // Đẩy xuống thấp hơn chút (tâm + 200px) để không bị Header che mặt
        model.y = app.screen.height / 2 + 200; 
        
        model.anchor.set(0.5, 0.5);

        // Tương tác
        model.on('hit', (hitAreas) => {
          if (hitAreas.includes('body')) model.motion('TapBody');
        });

        app.stage.addChild(model);
        console.log("Belle đã xuất hiện!");
        
        // Log motions để dùng sau này
        console.log("Motions:", model.internalModel.motionManager.definitions);

        setModelError(null);

      } catch (error) {
        console.error("Lỗi tải Belle:", error);
        if (appRef.current) setModelError("Không tải được Belle (Kiểm tra đường dẫn json).");
      }
    };

    loadModel();

    return () => {
      if (appRef.current && appRef.current.stage) {
        appRef.current.stage.removeChildren();
      }
    };
  }, []);

  if (modelError) return <div style={{color:'red', fontSize:12}}>{modelError}</div>;

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}