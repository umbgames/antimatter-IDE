use screenshots::Screen;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[tauri::command]
pub async fn capture_screen() -> Result<String, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    
    // Default to the primary screen (first one in the list usually)
    let screen = screens.first().ok_or_else(|| "No screens found".to_string())?;
    
    // Capture the screen
    let image = screen.capture().map_err(|e| format!("Failed to capture screen: {}", e))?;
    
    // Compress it a bit (resize or directly encode to PNG)
    let mut png_bytes: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);
    image.write_to(&mut cursor, screenshots::image::ImageOutputFormat::Png)
        .map_err(|e| format!("Failed to encode to PNG: {}", e))?;
    
    // Encode to base64
    let base64_image = BASE64.encode(png_bytes);
    
    Ok(format!("data:image/png;base64,{}", base64_image))
}
