// const express = require("express");
// const multer = require("multer");
// const cors = require("cors");
// const { exec } = require("child_process"); // To execute Pandoc
// const fs = require("fs"); // Node.js built-in file system module
// const fsExtra = require("fs-extra"); // For easier file operations like ensureDir, remove, rename
// const path = require("path"); // Node.js built-in path module

// const app = express();
// const uploadDir = path.join(__dirname, "uploads"); // Directory for uploaded files

// // --- IMPORTANT: Verify this path matches your Pandoc installation ---
// // If Pandoc is at 'C:\Program Files\Pandoc\pandoc.exe', use that.
// // If it's directly under C:\pandoc, then this path is correct.
// const PANDOC_EXECUTABLE_PATH = 'C:\\pandoc\\pandoc.exe';

// // Ensure the 'uploads' directory exists. If not, fsExtra will create it.
// fsExtra.ensureDirSync(uploadDir);

// // Configure multer to save uploaded files to the 'uploads' directory.
// // By default, multer assigns a unique filename without an extension. This is fine,
// // as we will rename it to add the .docx extension before Pandoc processes it.
// const upload = multer({ dest: uploadDir });

// // Enable CORS for your React app to make requests to this server.
// app.use(cors());
// // Enable parsing of JSON request bodies.
// app.use(express.json());

// // --- POST /upload Endpoint ---
// // This endpoint handles file uploads, calls Pandoc for conversion,
// // and sends back the converted HTML content.
// app.post("/upload", upload.single("file"), async (req, res) => {
//     // Check if a file was actually uploaded.
//     if (!req.file) {
//         return res.status(400).json({ error: "No file uploaded." });
//     }

//     console.log("Uploaded file details (multer):", req.file);

//     // multer stores the file with a generated unique name (e.g., '5deb1714ad4a80c6a75a60a30b4090ad').
//     const uploadedTempPath = req.file.path; // e.g., C:\...\uploads\5deb1714ad4a80c6a75a60a30b4090ad

//     // --- CRUCIAL FIX FOR GIBBERISH OUTPUT ---
//     // Pandoc often infers the input document type from its file extension.
//     // We need to rename the uploaded file to ensure it has a '.docx' extension.
//     const inputDocxPath = `${uploadedTempPath}.docx`; // e.g., C:\...\uploads\5deb1714ad4a80c6a75a60a30b4090ad.docx

//     // Define the path where Pandoc will write the converted HTML output.
//     const outputHtmlPath = `${uploadedTempPath}.html`; // e.g., C:\...\uploads\5deb1714ad4a80c6a75a60a30b4090ad.html

//     try {
//         // Step 1: Rename the uploaded file to add the .docx extension.
//         // This is synchronous to ensure it's done before Pandoc attempts to read it.
//         await fsExtra.rename(uploadedTempPath, inputDocxPath);
//         console.log(`Renamed uploaded file from "${uploadedTempPath}" to "${inputDocxPath}"`);

//         // Step 2: Construct the Pandoc command.
//         // - Enclose PANDOC_EXECUTABLE_PATH in quotes to handle spaces in the path (e.g., "C:\Program Files\Pandoc\pandoc.exe").
//         // - Use inputDocxPath as the source file for Pandoc.
//         // - Use outputHtmlPath as the destination for Pandoc's output.
//         // -s: --standalone, ensures a complete HTML document is produced.
//         // --mathml: Tells Pandoc to render equations using MathML.
//         const pandocCommand = `"${PANDOC_EXECUTABLE_PATH}" "${inputDocxPath}" -s --mathml --self-contained -o "${outputHtmlPath}"`;

//         console.log(`Executing Pandoc command: ${pandocCommand}`);

//         // Step 3: Execute Pandoc as a child process.
//         exec(pandocCommand, async (error, stdout, stderr) => {
//             // --- File Cleanup (important for managing temp files) ---
//             // Clean up the original input DOCX file first, regardless of Pandoc's success or failure.
//             try {
//                 await fsExtra.remove(inputDocxPath);
//                 console.log(`Cleaned up input .docx file: "${inputDocxPath}"`);
//             } catch (cleanupError) {
//                 // Log cleanup errors, but don't stop the main process flow if it's just a cleanup issue.
//                 // 'ENOENT' (Error No Entry) means the file doesn't exist, which is fine if Pandoc didn't create it.
//                 if (cleanupError.code !== 'ENOENT') {
//                     console.error(`Error cleaning up input file "${inputDocxPath}": ${cleanupError.message}`);
//                 }
//             }

//             // Check for errors returned by Pandoc execution.
//             if (error) {
//                 console.error(`Pandoc conversion failed: ${error.message}`);
//                 console.error(`Pandoc stdout (if any): ${stdout}`); // Sometimes Pandoc outputs errors to stdout too
//                 console.error(`Pandoc stderr: ${stderr}`); // Primary source of Pandoc errors

//                 // Clean up the output HTML file if it was partially created or if Pandoc failed.
//                 try {
//                     await fsExtra.remove(outputHtmlPath);
//                     console.log(`Cleaned up failed output .html file: "${outputHtmlPath}"`);
//                 } catch (cleanupError) {
//                     if (cleanupError.code !== 'ENOENT') {
//                         console.error(`Error cleaning up output file "${outputHtmlPath}" after Pandoc failure: ${cleanupError.message}`);
//                     }
//                 }
//                 return res.status(500).json({
//                     error: "Failed to convert document with Pandoc. Check server logs for details.",
//                     details: stderr || error.message // Provide Pandoc's stderr or a generic message
//                 });
//             }

//             console.log(`Pandoc conversion successful. Pandoc stdout: ${stdout}`);

//             // Step 4: Read the generated HTML content from the output file.
//             try {
//                 // Verify that the output HTML file actually exists before attempting to read it.
//                 if (!fs.existsSync(outputHtmlPath)) {
//                     console.error(`Pandoc finished, but output HTML file not found at: "${outputHtmlPath}"`);
//                     return res.status(500).json({
//                         error: "Pandoc conversion reported success, but HTML output file was not found.",
//                         details: `Expected output at: ${outputHtmlPath}. Please check server's file system permissions or Pandoc output location.`
//                     });
//                 }

//                 const htmlContent = await fsExtra.readFile(outputHtmlPath, 'utf8');
//                 console.log(`Successfully read HTML content from "${outputHtmlPath}". Content length: ${htmlContent.length} bytes`);

//                 // Step 5: Clean up the generated HTML file.
//                 await fsExtra.remove(outputHtmlPath);
//                 console.log(`Cleaned up output .html file: "${outputHtmlPath}"`);

//                 // Step 6: Send the HTML content back to the client.
//                 res.json({ content: htmlContent });

//             } catch (readError) {
//                 console.error(`Error reading output HTML or final cleanup: ${readError}`);
//                 res.status(500).json({
//                     error: "Failed to read converted HTML or perform final file cleanup.",
//                     details: readError.message
//                 });
//             }
//         });

//     } catch (err) {
//         // This catch block handles errors that occur before Pandoc exec (e.g., file renaming error).
//         console.error("Top-level server error during file processing or setup:", err);
//         // Ensure the original uploaded file (before renaming) is cleaned up if an early error occurs.
//         try {
//             await fsExtra.remove(uploadedTempPath);
//             console.log(`Cleaned up original uploaded temp file: "${uploadedTempPath}"`);
//         } catch (cleanupError) {
//             if (cleanupError.code !== 'ENOENT') {
//                 console.error(`Error cleaning up original uploaded file "${uploadedTempPath}" on top-level error: ${cleanupError.message}`);
//             }
//         }
//         res.status(500).json({
//             error: "An unexpected server error occurred before file conversion.",
//             details: err.message
//         });
//     }
// });

// const PORT = 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// const express = require("express");
// const multer = require("multer");
// const cors = require("cors");
// const { exec } = require("child_process"); // To execute Pandoc
// const fs = require("fs");
// const fsExtra = require("fs-extra");
// const path = require("path");
// const cheerio = require("cheerio"); // <--- NEW: Import cheerio for HTML parsing

// const app = express();
// const uploadDir = path.join(__dirname, "uploads");

// // --- IMPORTANT: Verify this path matches your Pandoc installation ---
// const PANDOC_EXECUTABLE_PATH = 'C:\\pandoc\\pandoc.exe'; 
// // Example if in Program Files: const PANDOC_EXECUTABLE_PATH = 'C:\\Program Files\\Pandoc\\pandoc.exe';

// fsExtra.ensureDirSync(uploadDir);

// const upload = multer({ dest: uploadDir });

// app.use(cors());
// app.use(express.json());

// app.post("/upload", upload.single("file"), async (req, res) => {
//     if (!req.file) {
//         return res.status(400).json({ error: "No file uploaded." });
//     }

//     console.log("Uploaded file details (multer):", req.file);

//     const uploadedTempPath = req.file.path;
//     const inputDocxPath = `${uploadedTempPath}.docx`;
//     const outputHtmlPath = `${uploadedTempPath}.html`;

//     try {
//         await fsExtra.rename(uploadedTempPath, inputDocxPath);
//         console.log(`Renamed uploaded file from "${uploadedTempPath}" to "${inputDocxPath}"`);

//         const pandocCommand = `"${PANDOC_EXECUTABLE_PATH}" "${inputDocxPath}" -s --mathml --self-contained -o "${outputHtmlPath}"`;
//         console.log(`Executing Pandoc command: ${pandocCommand}`);

//         exec(pandocCommand, async (error, stdout, stderr) => {
//             // --- File Cleanup for input DOCX ---
//             try {
//                 await fsExtra.remove(inputDocxPath);
//                 console.log(`Cleaned up input .docx file: "${inputDocxPath}"`);
//             } catch (cleanupError) {
//                 if (cleanupError.code !== 'ENOENT') {
//                     console.error(`Error cleaning up input file "${inputDocxPath}": ${cleanupError.message}`);
//                 }
//             }

//             if (error) {
//                 console.error(`Pandoc conversion failed: ${error.message}`);
//                 console.error(`Pandoc stdout (if any): ${stdout}`);
//                 console.error(`Pandoc stderr: ${stderr}`);

//                 // --- File Cleanup for output HTML on error ---
//                 try {
//                     await fsExtra.remove(outputHtmlPath);
//                     console.log(`Cleaned up failed output .html file: "${outputHtmlPath}"`);
//                 } catch (cleanupError) {
//                     if (cleanupError.code !== 'ENOENT') {
//                         console.error(`Error cleaning up output file "${outputHtmlPath}" after Pandoc failure: ${cleanupError.message}`);
//                     }
//                 }
//                 return res.status(500).json({
//                     error: "Failed to convert document with Pandoc. Check server logs for details.",
//                     details: stderr || error.message
//                 });
//             }

//             console.log(`Pandoc conversion successful. Pandoc stdout: ${stdout}`);

//             try {
//                 if (!fs.existsSync(outputHtmlPath)) {
//                     console.error(`Pandoc finished, but output HTML file not found at: "${outputHtmlPath}"`);
//                     return res.status(500).json({
//                         error: "Pandoc conversion reported success, but HTML output file was not found.",
//                         details: `Expected output at: ${outputHtmlPath}. Please check server's file system permissions or Pandoc output location.`
//                     });
//                 }

//                 const htmlContent = await fsExtra.readFile(outputHtmlPath, 'utf8');
//                 console.log(`Successfully read HTML content from "${outputHtmlPath}". Content length: ${htmlContent.length} bytes`);

//                 // --- NEW: Process HTML with Cheerio to remove unwanted body styles ---
//                 const $ = cheerio.load(htmlContent);

//                 // Iterate over all <style> tags in the <head> section
//                 $('head style').each((index, element) => {
//                     let styleContent = $(element).html();

//                     // Regex to find and remove specific properties from the 'body' rule.
//                     // It targets 'body' selector and then tries to remove the specific properties.
//                     // The 's' flag allows '.' to match newlines (dotAll).
//                     // The 'g' flag makes replace all occurrences.
//                     // The '?' makes the preceding character optional, allowing for optional semicolons.
//                     const propertiesToRemove = [
//                         'margin:[^;]*;?',
//                         'max-width:[^;]*;?',
//                         'padding-left:[^;]*;?',
//                         'padding-right:[^;]*;?',
//                         'padding-top:[^;]*;?',
//                         'padding-bottom:[^;]*;?'
//                     ];

//                     // Construct a regex to find the body block and perform replacements within it.
//                     // This finds 'body { ... }' and captures its content.
//                     styleContent = styleContent.replace(
//                         /(body\s*\{[^}]*)/s,
//                         (match, bodyRuleBlock) => {
//                             let modifiedBodyRuleBlock = bodyRuleBlock;
//                             propertiesToRemove.forEach(propRegexStr => {
//                                 // Use a regex to find and remove the property and its value,
//                                 // including optional whitespace around it and semicolon.
//                                 const regex = new RegExp(`\\s*${propRegexStr}`, 'g');
//                                 modifiedBodyRuleBlock = modifiedBodyRuleBlock.replace(regex, '');
//                             });
//                             return modifiedBodyRuleBlock;
//                         }
//                     );

//                     // After removing properties, you might end up with empty rules or extra whitespace.
//                     // You could add logic here to remove empty 'body {}' rules if desired,
//                     // or simply allow it as it's harmless.

//                     // Update the style tag's content with the modified CSS
//                     $(element).html(styleContent);
//                 });

//                 // Get the complete HTML string after modification
//                 const cleanedHtmlContent = $.html();
//                 // --- END NEW HTML Processing ---

//                 // --- File Cleanup for output HTML ---
//                 await fsExtra.remove(outputHtmlPath);
//                 console.log(`Cleaned up output .html file: "${outputHtmlPath}"`);

//                 // Send the CLEANED HTML content back to the client
//                 res.json({ content: cleanedHtmlContent });

//             } catch (readError) {
//                 console.error(`Error reading output HTML or final cleanup: ${readError}`);
//                 res.status(500).json({
//                     error: "Failed to read converted HTML or perform final file cleanup.",
//                     details: readError.message
//                 });
//             }
//         });

//     } catch (err) {
//         console.error("Top-level server error during file processing or setup:", err);
//         try {
//             await fsExtra.remove(uploadedTempPath);
//             console.log(`Cleaned up original uploaded temp file: "${uploadedTempPath}"`);
//         } catch (cleanupError) {
//             if (cleanupError.code !== 'ENOENT') {
//                 console.error(`Error cleaning up original uploaded file "${uploadedTempPath}" on top-level error: ${cleanupError.message}`);
//             }
//         }
//         res.status(500).json({
//             error: "An unexpected server error occurred before file conversion.",
//             details: err.message
//         });
//     }
// });

// const PORT = 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { exec } = require("child_process"); // To execute Pandoc
const fs = require("fs"); // Node.js built-in file system module
const fsExtra = require("fs-extra"); // For easier file operations like ensureDir, remove, rename
const path = require("path"); // Node.js built-in path module
const cheerio = require("cheerio"); // For HTML parsing and manipulation

const app = express();
const uploadDir = path.join(__dirname, "uploads"); // Directory for uploaded files

// --- IMPORTANT: Verify this path matches your Pandoc installation ---
// Example: If Pandoc is at 'C:\Program Files\Pandoc\pandoc.exe', use that.
const PANDOC_EXECUTABLE_PATH = 'C:\\pandoc\\pandoc.exe';

// Ensure the 'uploads' directory exists. If not, fsExtra will create it.
fsExtra.ensureDirSync(uploadDir);

// Configure multer to save uploaded files to the 'uploads' directory.
// Changed from .single("file") to .array("files") to accept multiple files.
// The 'files' string matches the field name on the client-side FormData.
const upload = multer({ dest: uploadDir });

// Enable CORS for your React app.
app.use(cors());
// Enable parsing of JSON request bodies.
app.use(express.json());

// --- Helper function to process a single uploaded file ---
// This function encapsulates the logic for renaming, Pandoc conversion,
// HTML cleaning, and file cleanup for one .docx file.
async function processSingleFile(file) {
    const uploadedTempPath = file.path; // Multer's temporary path for this file
    const inputDocxPath = `${uploadedTempPath}.docx`; // Path after renaming to .docx
    const outputHtmlPath = `${uploadedTempPath}.html`; // Path for Pandoc's HTML output

    try {
        // Step 1: Rename the uploaded file to add the .docx extension.
        await fsExtra.rename(uploadedTempPath, inputDocxPath);
        console.log(`Renamed "${file.originalname}" from "${uploadedTempPath}" to "${inputDocxPath}"`);

        // Step 2: Construct and execute the Pandoc command.
        const pandocCommand = `"${PANDOC_EXECUTABLE_PATH}" "${inputDocxPath}" -s --mathml --self-contained -o "${outputHtmlPath}"`;
        console.log(`Executing Pandoc command for "${file.originalname}": ${pandocCommand}`);

        // Wrap exec in a Promise to use with async/await for cleaner flow
        await new Promise((resolve, reject) => {
            exec(pandocCommand, async (error, stdout, stderr) => {
                // --- Cleanup input DOCX file ---
                try {
                    await fsExtra.remove(inputDocxPath);
                    console.log(`Cleaned up input .docx file for "${file.originalname}"`);
                } catch (cleanupError) {
                    if (cleanupError.code !== 'ENOENT') { // ENOENT means file doesn't exist, which is fine
                        console.error(`Error cleaning up input file "${inputDocxPath}" for "${file.originalname}": ${cleanupError.message}`);
                    }
                }

                if (error) {
                    console.error(`Pandoc conversion failed for "${file.originalname}": ${error.message}`);
                    console.error(`Pandoc stderr for "${file.originalname}": ${stderr}`);
                    // --- Cleanup output HTML file on error ---
                    try {
                        await fsExtra.remove(outputHtmlPath);
                        console.log(`Cleaned up failed output .html file for "${file.originalname}"`);
                    } catch (cleanupError) {
                        if (cleanupError.code !== 'ENOENT') {
                            console.error(`Error cleaning up output file "${outputHtmlPath}" after Pandoc failure for "${file.originalname}": ${cleanupError.message}`);
                        }
                    }
                    return reject(new Error(`Pandoc conversion failed for "${file.originalname}": ${stderr || error.message}`));
                }

                console.log(`Pandoc conversion successful for "${file.originalname}". Pandoc stdout: ${stdout}`);
                resolve(); // Resolve the promise if Pandoc command succeeds
            });
        });

        // Step 3: Read the generated HTML content from the output file.
        if (!fs.existsSync(outputHtmlPath)) {
            throw new Error(`Pandoc finished, but output HTML file not found for "${file.originalname}" at: "${outputHtmlPath}"`);
        }
        let htmlContent = await fsExtra.readFile(outputHtmlPath, 'utf8');
        console.log(`Successfully read HTML content from "${outputHtmlPath}" for "${file.originalname}". Content length: ${htmlContent.length} bytes`);

        // Step 4: Process HTML with Cheerio to remove unwanted body styles.
        const $ = cheerio.load(htmlContent);
        $('head style').each((index, element) => {
            let styleContent = $(element).html();
            const propertiesToRemove = [
                'margin:[^;]*;?',
                'max-width:[^;]*;?',
                'padding-left:[^;]*;?',
                'padding-right:[^;]*;?',
                'padding-top:[^;]*;?',
                'padding-bottom:[^;]*;?'
            ];
            styleContent = styleContent.replace(
                /(body\s*\{[^}]*)/s,
                (match, bodyRuleBlock) => {
                    let modifiedBodyRuleBlock = bodyRuleBlock;
                    propertiesToRemove.forEach(propRegexStr => {
                        const regex = new RegExp(`\\s*${propRegexStr}`, 'g');
                        modifiedBodyRuleBlock = modifiedBodyRuleBlock.replace(regex, '');
                    });
                    return modifiedBodyRuleBlock;
                }
            );
            $(element).html(styleContent);
        });
        const cleanedHtmlContent = $.html();

        // Step 5: Clean up the generated HTML file.
        await fsExtra.remove(outputHtmlPath);
        console.log(`Cleaned up output .html file for "${file.originalname}"`);

        // Return an object with the filename and its cleaned HTML content.
        return { filename: file.originalname, content: cleanedHtmlContent, status: 'success' };

    } catch (err) {
        // This catch block handles errors during renaming, Pandoc execution (via Promise rejection),
        // HTML reading, or HTML processing.
        console.error(`Error processing file "${file.originalname}": ${err.message}`);
        // Ensure original uploaded temp file (from multer) is cleaned up if an early error occurs.
        try {
            await fsExtra.remove(uploadedTempPath);
            console.log(`Cleaned up original uploaded temp file for "${file.originalname}" on error.`);
        } catch (cleanupErr) {
            if (cleanupErr.code !== 'ENOENT') {
                console.error(`Error cleaning up original uploaded file "${uploadedTempPath}" on top-level error for "${file.originalname}": ${cleanupErr.message}`);
            }
        }
        // Return a 'failed' status for this specific file, including its error.
        return { filename: file.originalname, error: err.message, status: 'failed' };
    }
}

// ---

// ### ** POST`/upload` Endpoint(Modified for Multiple Files)**

// ```javascript
app.post("/upload", upload.array("files"), async (req, res) => {
    // Check if any files were actually uploaded.
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
    }

    console.log(`Received ${req.files.length} files for upload.`);

    // Process all files concurrently using Promise.all
    // Each call to processSingleFile returns a Promise that resolves with a result object
    const processingPromises = req.files.map(file => processSingleFile(file));

    try {
        const results = await Promise.all(processingPromises);

        // Separate successful conversions from failed ones
        const successfulContents = results.filter(r => r.status === 'success');
        const failedContents = results.filter(r => r.status === 'failed');

        if (successfulContents.length > 0) {
            // Send successful conversions as an array of objects
            res.json({
                contents: successfulContents,
                // Optionally include details about failed conversions if any
                failed: failedContents.length > 0 ? failedContents : undefined
            });
        } else {
            // If all files failed, return a 500 status with error details
            res.status(500).json({
                error: "All files failed to convert.",
                failed: failedContents
            });
        }

    } catch (overallError) {
        // This catch block would primarily handle unexpected errors from Promise.all itself
        // (e.g., if one of the file processing promises rejected before all were settled).
        console.error("Overall error during multiple file processing:", overallError);
        res.status(500).json({
            error: "An unexpected error occurred during file processing.",
            details: overallError.message
        });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} `));