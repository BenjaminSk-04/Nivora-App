package com.nivora.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import androidx.activity.OnBackPressedCallback
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Nivora is a self-contained web app (see assets/www/index.html) wrapped in a WebView.
 * All app data (expenses, medicines, budgets, profile) lives in the WebView's own local
 * storage, on this device only. This Activity's job is just to:
 *   1. Host that WebView full-screen.
 *   2. Make the HTML's two native-ish features actually work on Android:
 *        - "Scan bill" -> file <input> needs a real camera/gallery chooser.
 *        - "Backup & Restore" -> export/import a JSON file via the system file picker,
 *          exposed to the page as `window.AndroidBridge`.
 *   3. Open external links (e.g. the WhatsApp share link for caregiver alerts) in a
 *      real browser/app instead of navigating away inside the WebView.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    // --- file chooser state (Scan bill camera/gallery, and any other <input type=file>) ---
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraUri: Uri? = null

    private val requestCameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) launchCameraCapture() else {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = null
            }
        }

    private val cameraCaptureLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uri = pendingCameraUri
            if (result.resultCode == RESULT_OK && uri != null) {
                fileChooserCallback?.onReceiveValue(arrayOf(uri))
            } else {
                fileChooserCallback?.onReceiveValue(null)
            }
            fileChooserCallback = null
            pendingCameraUri = null
        }

    private val galleryPickLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            val uri = if (result.resultCode == RESULT_OK) data?.data else null
            fileChooserCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
            fileChooserCallback = null
        }

    // --- Backup & Restore (Settings > Backup & Restore in the web UI) ---
    private var pendingBackupContent: String? = null

    private val createBackupDocLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uri = result.data?.data
            val content = pendingBackupContent
            pendingBackupContent = null
            val ok = uri != null && content != null && writeTextToUri(uri, content)
            runOnUiThread { webView.evaluateJavascript("window.onBackupSaved && window.onBackupSaved($ok)", null) }
        }

    private val openBackupDocLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uri = result.data?.data
            val text = uri?.let { readTextFromUri(it) }
            val encoded = if (text != null) JSONObject.quote(text) else "null"
            runOnUiThread { webView.evaluateJavascript("window.onBackupPicked && window.onBackupPicked($encoded)", null) }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true           // required: the app's state lives in localStorage
                databaseEnabled = true
                allowFileAccess = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                mediaPlaybackRequiresUserGesture = false
            }
            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
            webViewClient = NivoraWebViewClient()
            webChromeClient = NivoraWebChromeClient()
            loadUrl("file:///android_asset/www/index.html")
        }
        setContentView(webView)

        // Let in-page "back" (closing a modal, going to the previous tab) win first;
        // only exit the app once there is nothing left for the WebView to go back to.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    // ---------------------------------------------------------------------
    // WebViewClient: keep normal/local navigation inside the app, send real
    // http(s) links (e.g. the WhatsApp caregiver-alert link) to an external app.
    // ---------------------------------------------------------------------
    private inner class NivoraWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest): Boolean {
            val uri = request.url
            return if (uri.scheme == "http" || uri.scheme == "https") {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                } catch (_: Exception) {
                    // No app can handle it (e.g. no browser/WhatsApp installed) - just ignore.
                }
                true
            } else {
                false // file:// (our app) and javascript:/about:blank etc. stay in the WebView
            }
        }
    }

    // ---------------------------------------------------------------------
    // WebChromeClient: wire up <input type="file"> to a real camera/gallery/
    // document chooser. The web UI uses this for "Scan bill" (two inputs: one
    // with capture="environment" for the camera, one without for the gallery)
    // and for the "Import" button on the Backup & Restore card.
    // ---------------------------------------------------------------------
    private inner class NivoraWebChromeClient : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams
        ): Boolean {
            fileChooserCallback?.onReceiveValue(null)
            fileChooserCallback = filePathCallback

            val acceptTypes = fileChooserParams.acceptTypes
            val wantsImage = acceptTypes.any { it.contains("image") }
            val wantsCamera = fileChooserParams.isCaptureEnabled

            if (wantsCamera || (wantsImage && fileChooserParams.mode == FileChooserParams.MODE_OPEN)) {
                if (wantsCamera) {
                    if (hasCameraPermission()) launchCameraCapture() else requestCameraPermission.launch(Manifest.permission.CAMERA)
                    return true
                }
            }

            // Gallery / generic file picker (also used for the JSON import <input>, though
            // that one is normally routed through AndroidBridge.pickBackup() instead).
            val mimeType = acceptTypes.firstOrNull { it.isNotBlank() } ?: "*/*"
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = if (mimeType == "*/*" || mimeType.contains(",")) "*/*" else mimeType
            }
            galleryPickLauncher.launch(intent)
            return true
        }
    }

    private fun hasCameraPermission() =
        checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun launchCameraCapture() {
        val callback = fileChooserCallback
        if (callback == null) return
        val photoFile = createCaptureFile()
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", photoFile)
        pendingCameraUri = uri
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }
        if (intent.resolveActivity(packageManager) != null) {
            cameraCaptureLauncher.launch(intent)
        } else {
            callback.onReceiveValue(null)
            fileChooserCallback = null
        }
    }

    private fun createCaptureFile(): File {
        val dir = File(cacheDir, "captured").apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return File(dir, "bill_$stamp.jpg")
    }

    private fun writeTextToUri(uri: Uri, content: String): Boolean = try {
        contentResolver.openOutputStream(uri)?.use { out ->
            out.write(content.toByteArray(Charsets.UTF_8))
        }
        true
    } catch (_: Exception) {
        false
    }

    private fun readTextFromUri(uri: Uri): String? = try {
        contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
    } catch (_: Exception) {
        null
    }

    /**
     * Exposed to the web app as `window.AndroidBridge`. Lets Settings > Backup & Restore
     * save/open a real file via Android's Storage Access Framework, instead of relying on
     * a browser-style download link (which a plain WebView does not support).
     */
    private inner class AndroidBridge {
        @JavascriptInterface
        fun saveBackup(json: String, filename: String) {
            pendingBackupContent = json
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "application/json"
                putExtra(Intent.EXTRA_TITLE, filename)
            }
            runOnUiThread { createBackupDocLauncher.launch(intent) }
        }

        @JavascriptInterface
        fun pickBackup() {
            // Some file providers mislabel .json files as text/plain, so accept both
            // rather than risk the backup file not showing up in the picker at all.
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/plain"))
            }
            runOnUiThread { openBackupDocLauncher.launch(intent) }
        }
    }
}
