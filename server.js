const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { exec } = require("child_process"); // To execute Pandoc
const fs = require("fs"); // Node.js built-in file system module
const fsExtra = require("fs-extra"); // For easier file operations like ensureDir, remove, rename
const path = require("path"); // Node.js built-in path module

const app = express();
const uploadDir = path.join(__dirname, "uploads"); // Directory for uploaded files

// --- IMPORTANT: Verify this path matches your Pandoc installation ---
// If Pandoc is at 'C:\Program Files\Pandoc\pandoc.exe', use that.
// If it's directly under C:\pandoc, then this path is correct.
const PANDOC_EXECUTABLE_PATH = 'C:\\pandoc\\pandoc.exe';

// Ensure the 'uploads' directory exists. If not, fsExtra will create it.
fsExtra.ensureDirSync(uploadDir);

// Configure multer to save uploaded files to the 'uploads' directory.
// By default, multer assigns a unique filename without an extension. This is fine,
// as we will rename it to add the .docx extension before Pandoc processes it.
const upload = multer({ dest: uploadDir });

// Enable CORS for your React app to make requests to this server.
app.use(cors());
// Enable parsing of JSON request bodies.
app.use(express.json());

// --- POST /upload Endpoint ---
// This endpoint handles file uploads, calls Pandoc for conversion,
// and sends back the converted HTML content.
app.post("/upload", upload.single("file"), async (req, res) => {
    // Check if a file was actually uploaded.
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }

    console.log("Uploaded file details (multer):", req.file);

    // multer stores the file with a generated unique name (e.g., '5deb1714ad4a80c6a75a60a30b4090ad').
    const uploadedTempPath = req.file.path; // e.g., C:\...\uploads\5deb1714ad4a80c6a75a60a30b4090ad

    // --- CRUCIAL FIX FOR GIBBERISH OUTPUT ---
    // Pandoc often infers the input document type from its file extension.
    // We need to rename the uploaded file to ensure it has a '.docx' extension.
    const inputDocxPath = `${uploadedTempPath}.docx`; // e.g., C:\...\uploads\5deb1714ad4a80c6a75a60a30b4090ad.docx

    // Define the path where Pandoc will write the converted HTML output.
    const outputHtmlPath = `${uploadedTempPath}.html`; // e.g., C:\...\uploads\5deb1714ad4a80c6a75a60a30b4090ad.html

    try {
        // Step 1: Rename the uploaded file to add the .docx extension.
        // This is synchronous to ensure it's done before Pandoc attempts to read it.
        await fsExtra.rename(uploadedTempPath, inputDocxPath);
        console.log(`Renamed uploaded file from "${uploadedTempPath}" to "${inputDocxPath}"`);

        // Step 2: Construct the Pandoc command.
        // - Enclose PANDOC_EXECUTABLE_PATH in quotes to handle spaces in the path (e.g., "C:\Program Files\Pandoc\pandoc.exe").
        // - Use inputDocxPath as the source file for Pandoc.
        // - Use outputHtmlPath as the destination for Pandoc's output.
        // -s: --standalone, ensures a complete HTML document is produced.
        // --mathml: Tells Pandoc to render equations using MathML.
        const pandocCommand = `"${PANDOC_EXECUTABLE_PATH}" "${inputDocxPath}" -s --mathml --self-contained -o "${outputHtmlPath}"`;

        console.log(`Executing Pandoc command: ${pandocCommand}`);

        // Step 3: Execute Pandoc as a child process.
        exec(pandocCommand, async (error, stdout, stderr) => {
            // --- File Cleanup (important for managing temp files) ---
            // Clean up the original input DOCX file first, regardless of Pandoc's success or failure.
            try {
                await fsExtra.remove(inputDocxPath);
                console.log(`Cleaned up input .docx file: "${inputDocxPath}"`);
            } catch (cleanupError) {
                // Log cleanup errors, but don't stop the main process flow if it's just a cleanup issue.
                // 'ENOENT' (Error No Entry) means the file doesn't exist, which is fine if Pandoc didn't create it.
                if (cleanupError.code !== 'ENOENT') {
                    console.error(`Error cleaning up input file "${inputDocxPath}": ${cleanupError.message}`);
                }
            }

            // Check for errors returned by Pandoc execution.
            if (error) {
                console.error(`Pandoc conversion failed: ${error.message}`);
                console.error(`Pandoc stdout (if any): ${stdout}`); // Sometimes Pandoc outputs errors to stdout too
                console.error(`Pandoc stderr: ${stderr}`); // Primary source of Pandoc errors

                // Clean up the output HTML file if it was partially created or if Pandoc failed.
                try {
                    await fsExtra.remove(outputHtmlPath);
                    console.log(`Cleaned up failed output .html file: "${outputHtmlPath}"`);
                } catch (cleanupError) {
                    if (cleanupError.code !== 'ENOENT') {
                        console.error(`Error cleaning up output file "${outputHtmlPath}" after Pandoc failure: ${cleanupError.message}`);
                    }
                }
                return res.status(500).json({
                    error: "Failed to convert document with Pandoc. Check server logs for details.",
                    details: stderr || error.message // Provide Pandoc's stderr or a generic message
                });
            }

            console.log(`Pandoc conversion successful. Pandoc stdout: ${stdout}`);

            // Step 4: Read the generated HTML content from the output file.
            try {
                // Verify that the output HTML file actually exists before attempting to read it.
                if (!fs.existsSync(outputHtmlPath)) {
                    console.error(`Pandoc finished, but output HTML file not found at: "${outputHtmlPath}"`);
                    return res.status(500).json({
                        error: "Pandoc conversion reported success, but HTML output file was not found.",
                        details: `Expected output at: ${outputHtmlPath}. Please check server's file system permissions or Pandoc output location.`
                    });
                }

                const htmlContent = await fsExtra.readFile(outputHtmlPath, 'utf8');
                console.log(`Successfully read HTML content from "${outputHtmlPath}". Content length: ${htmlContent.length} bytes`);

                // Step 5: Clean up the generated HTML file.
                await fsExtra.remove(outputHtmlPath);
                console.log(`Cleaned up output .html file: "${outputHtmlPath}"`);

                // Step 6: Send the HTML content back to the client.
                res.json({ content: htmlContent });

            } catch (readError) {
                console.error(`Error reading output HTML or final cleanup: ${readError}`);
                res.status(500).json({
                    error: "Failed to read converted HTML or perform final file cleanup.",
                    details: readError.message
                });
            }
        });

    } catch (err) {
        // This catch block handles errors that occur before Pandoc exec (e.g., file renaming error).
        console.error("Top-level server error during file processing or setup:", err);
        // Ensure the original uploaded file (before renaming) is cleaned up if an early error occurs.
        try {
            await fsExtra.remove(uploadedTempPath);
            console.log(`Cleaned up original uploaded temp file: "${uploadedTempPath}"`);
        } catch (cleanupError) {
            if (cleanupError.code !== 'ENOENT') {
                console.error(`Error cleaning up original uploaded file "${uploadedTempPath}" on top-level error: ${cleanupError.message}`);
            }
        }
        res.status(500).json({
            error: "An unexpected server error occurred before file conversion.",
            details: err.message
        });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));