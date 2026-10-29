package com.forerun.customer.core.update

import android.content.Context
import android.content.Intent
import android.os.Environment
import androidx.core.content.FileProvider
import com.forerun.customer.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

sealed class DownloadState {
    data object Idle : DownloadState()
    data class Downloading(val progress: Int) : DownloadState()  // 0-100
    data object Installing : DownloadState()
    data class Failed(val messageRes: Int) : DownloadState()
}

class ApkDownloader(private val context: Context) {

    fun downloadAndInstall(url: String): Flow<DownloadState> = flow {
        emit(DownloadState.Downloading(0))

        val downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: context.filesDir
        downloadsDir.mkdirs()

        val apkFile = File(
            downloadsDir,
            "forerun-update.apk"
        )
        val tempApkFile = File(
            downloadsDir,
            "forerun-update.apk.tmp"
        )

        try {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.instanceFollowRedirects = true
            connection.connect()

            val responseCode = connection.responseCode
            if (responseCode !in 200..299) {
                tempApkFile.delete()
                emit(DownloadState.Failed(R.string.update_download_failed))
                return@flow
            }

            val totalBytes = connection.contentLengthLong
            var downloadedBytes = 0L

            connection.inputStream.use { input ->
                tempApkFile.outputStream().use { output ->
                    val buffer = ByteArray(8 * 1024)
                    var bytes: Int
                    while (input.read(buffer).also { bytes = it } != -1) {
                        output.write(buffer, 0, bytes)
                        downloadedBytes += bytes
                        if (totalBytes > 0) {
                            val progress = ((downloadedBytes * 100) / totalBytes).toInt().coerceIn(0, 100)
                            emit(DownloadState.Downloading(progress))
                        }
                    }
                }
            }

            if (apkFile.exists()) {
                apkFile.delete()
            }
            if (!tempApkFile.renameTo(apkFile)) {
                tempApkFile.copyTo(apkFile, overwrite = true)
                tempApkFile.delete()
            }

            emit(DownloadState.Installing)
            installApk(apkFile)

        } catch (e: Exception) {
            tempApkFile.delete()
            emit(DownloadState.Failed(R.string.update_download_failed))
        }
    }.flowOn(Dispatchers.IO)

    private fun installApk(file: File) {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
