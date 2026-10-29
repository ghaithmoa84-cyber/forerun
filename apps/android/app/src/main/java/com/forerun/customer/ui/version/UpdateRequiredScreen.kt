package com.forerun.customer.ui.version

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.forerun.customer.R
import com.forerun.customer.core.config.AppConfig
import com.forerun.customer.core.update.ApkDownloader
import com.forerun.customer.core.update.DownloadState
import com.forerun.customer.core.version.AppUpdateHolder
import com.forerun.customer.domain.model.AppVersion
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunPrimary
import com.forerun.customer.ui.theme.ForerunPrimaryLight
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary
import com.forerun.customer.ui.theme.WhatsAppGreen
import kotlinx.coroutines.launch

@Composable
fun UpdateRequiredScreen(
    appUpdateHolder: AppUpdateHolder,
    modifier: Modifier = Modifier
) {
    val mandatoryUpdate by appUpdateHolder.mandatoryUpdate.collectAsStateWithLifecycle()
    UpdateRequiredContent(
        version = mandatoryUpdate,
        modifier = modifier
    )
}

@Composable
fun UpdateRequiredContent(
    version: AppVersion?,
    modifier: Modifier = Modifier
) {
    // Intercept back button to strictly prevent navigating away from update wall
    BackHandler {
        // Deliberate no-op: app cannot be used until updated
    }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var downloadState by remember { mutableStateOf<DownloadState>(DownloadState.Idle) }
    val versionName = version?.latestVersionName ?: ""

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ForerunBackground)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dimens.ScreenMargin, vertical = Dimens.Space32),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Icon Badge
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(ForerunPrimaryLight),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.SystemUpdate,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = ForerunPrimary
            )
        }

        Spacer(modifier = Modifier.height(Dimens.Space24))

        Text(
            text = stringResource(R.string.update_required_title),
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunTextPrimary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(Dimens.Space12))

        Text(
            text = stringResource(R.string.update_required_subtitle, versionName),
            fontSize = 15.sp,
            color = ForerunTextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 24.sp,
            modifier = Modifier.padding(horizontal = Dimens.Space16)
        )

        if (!version?.releaseNotes.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(Dimens.Space24))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Dimens.RadiusMedium))
                    .background(ForerunSurface)
                    .border(1.dp, ForerunBorder, RoundedCornerShape(Dimens.RadiusMedium))
                    .padding(Dimens.Space16)
            ) {
                Text(
                    text = stringResource(R.string.update_notes_title),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Spacer(modifier = Modifier.height(Dimens.Space8))
                Text(
                    text = version!!.releaseNotes!!,
                    fontSize = 13.sp,
                    color = ForerunTextMuted,
                    lineHeight = 20.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space32))

        // Download & Install Action Area
        when (val state = downloadState) {
            is DownloadState.Idle -> {
                Button(
                    onClick = {
                        val downloadUrl = version?.downloadUrl
                        if (!downloadUrl.isNullOrBlank()) {
                            scope.launch {
                                ApkDownloader(context)
                                    .downloadAndInstall(downloadUrl)
                                    .collect { downloadState = it }
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(Dimens.ButtonHeight),
                    shape = RoundedCornerShape(Dimens.RadiusMedium),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ForerunPrimary,
                        contentColor = ForerunTextOnPrimary
                    )
                ) {
                    Text(
                        text = stringResource(R.string.update_download_button),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            is DownloadState.Downloading -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = Dimens.Space8),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    LinearProgressIndicator(
                        progress = { state.progress / 100f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(Dimens.RadiusPill)),
                        color = ForerunPrimary,
                        trackColor = ForerunPrimaryLight
                    )
                    Spacer(Modifier.height(Dimens.Space8))
                    Text(
                        text = stringResource(R.string.update_downloading_progress, state.progress),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = ForerunTextPrimary
                    )
                }
            }

            is DownloadState.Installing -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = Dimens.Space8),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator(
                        color = ForerunPrimary,
                        modifier = Modifier.size(28.dp),
                        strokeWidth = 3.dp
                    )
                    Spacer(Modifier.height(Dimens.Space8))
                    Text(
                        text = stringResource(R.string.update_installing),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = ForerunTextPrimary
                    )
                }
            }

            is DownloadState.Failed -> {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = stringResource(state.messageRes),
                        color = ForerunDanger,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(Dimens.Space8))
                    Button(
                        onClick = { downloadState = DownloadState.Idle },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(Dimens.ButtonHeight),
                        shape = RoundedCornerShape(Dimens.RadiusMedium),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = ForerunPrimary,
                            contentColor = ForerunTextOnPrimary
                        )
                    ) {
                        Text(
                            text = stringResource(R.string.update_retry),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space12))

        // Emergency WhatsApp Support Button
        val whatsappMsg = stringResource(R.string.update_support_whatsapp_msg)
        OutlinedButton(
            onClick = {
                val intent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(AppConfig.buildWhatsAppUrl(whatsappMsg))
                )
                try {
                    context.startActivity(intent)
                } catch (_: Exception) {
                    // Safe fallback
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(Dimens.ButtonHeight),
            shape = RoundedCornerShape(Dimens.RadiusMedium),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = WhatsAppGreen
            ),
            border = androidx.compose.foundation.BorderStroke(1.dp, WhatsAppGreen.copy(alpha = 0.5f))
        ) {
            Text(
                text = stringResource(R.string.update_support_button),
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
