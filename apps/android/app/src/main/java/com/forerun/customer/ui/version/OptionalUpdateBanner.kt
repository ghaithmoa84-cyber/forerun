package com.forerun.customer.ui.version

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.forerun.customer.R
import com.forerun.customer.core.update.ApkDownloader
import com.forerun.customer.core.update.DownloadState
import com.forerun.customer.domain.model.AppVersion
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunPrimary
import com.forerun.customer.ui.theme.ForerunPrimaryLight
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary
import kotlinx.coroutines.launch

@Composable
fun OptionalUpdateBanner(
    version: AppVersion,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var downloadState by remember { mutableStateOf<DownloadState>(DownloadState.Idle) }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Dimens.RadiusMedium))
            .background(ForerunSurface)
            .border(1.dp, ForerunPrimary.copy(alpha = 0.35f), RoundedCornerShape(Dimens.RadiusMedium))
            .padding(Dimens.Space14)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(ForerunPrimaryLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.SystemUpdate,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = ForerunPrimary
                    )
                }

                Spacer(modifier = Modifier.width(Dimens.Space10))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.update_optional_banner_title, version.latestVersionName),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = stringResource(R.string.update_optional_banner_desc),
                        fontSize = 12.sp,
                        color = ForerunTextMuted,
                        lineHeight = 16.sp
                    )
                }

                if (downloadState is DownloadState.Idle || downloadState is DownloadState.Failed) {
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.update_optional_banner_dismiss),
                            modifier = Modifier.size(16.dp),
                            tint = ForerunTextMuted
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space10))

            when (val state = downloadState) {
                is DownloadState.Idle -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(
                            onClick = onDismiss,
                            modifier = Modifier.height(34.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.update_optional_banner_dismiss),
                                fontSize = 12.sp,
                                color = ForerunTextMuted
                            )
                        }

                        Spacer(modifier = Modifier.width(Dimens.Space8))

                        Button(
                            onClick = {
                                val url = version.downloadUrl
                                if (!url.isNullOrBlank()) {
                                    scope.launch {
                                        ApkDownloader(context)
                                            .downloadAndInstall(url)
                                            .collect { downloadState = it }
                                    }
                                }
                            },
                            modifier = Modifier.height(34.dp),
                            shape = RoundedCornerShape(Dimens.RadiusSmall),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = ForerunPrimary,
                                contentColor = ForerunTextOnPrimary
                            )
                        ) {
                            Text(
                                text = stringResource(R.string.update_optional_banner_btn),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                is DownloadState.Downloading -> {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        LinearProgressIndicator(
                            progress = { state.progress / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(Dimens.RadiusPill)),
                            color = ForerunPrimary,
                            trackColor = ForerunPrimaryLight
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = stringResource(R.string.update_downloading_progress, state.progress),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ForerunTextPrimary
                        )
                    }
                }

                is DownloadState.Installing -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            color = ForerunPrimary,
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = stringResource(R.string.update_installing),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ForerunTextPrimary
                        )
                    }
                }

                is DownloadState.Failed -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(state.messageRes),
                            color = ForerunDanger,
                            fontSize = 11.sp,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(Modifier.width(8.dp))
                        Button(
                            onClick = { downloadState = DownloadState.Idle },
                            modifier = Modifier.height(32.dp),
                            shape = RoundedCornerShape(Dimens.RadiusSmall),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = ForerunPrimary,
                                contentColor = ForerunTextOnPrimary
                            )
                        ) {
                            Text(
                                text = stringResource(R.string.update_retry),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
