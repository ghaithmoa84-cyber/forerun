package com.forerun.customer.ui.rating

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.forerun.customer.R
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenDark
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RatingScreen(
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: RatingViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    val successMsg = if (uiState.isExistingRating) {
        stringResource(R.string.rating_success_updated)
    } else {
        stringResource(R.string.rating_success_created)
    }

    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            snackbarHostState.showSnackbar(successMsg)
            onNavigateBack()
        }
    }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onIntent(RatingIntent.ClearError)
        }
    }

    LaunchedEffect(uiState.validationError) {
        uiState.validationError?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onIntent(RatingIntent.ClearError)
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = ForerunSoftSurface,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.rating_screen_title),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = null,
                            tint = ForerunTextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ForerunSurface)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        if (uiState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ForerunGreen)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .padding(Dimens.Space16),
                verticalArrangement = Arrangement.spacedBy(Dimens.Space16),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header Card with Runner Info
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(Dimens.RadiusLarge),
                    colors = CardDefaults.cardColors(containerColor = ForerunSurface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(Dimens.Space20),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(ForerunGreenLight),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = ForerunGreen,
                                modifier = Modifier.size(36.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(Dimens.Space12))

                        Text(
                            text = stringResource(R.string.rating_headline),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunTextPrimary
                        )

                        Spacer(modifier = Modifier.height(Dimens.Space4))

                        Text(
                            text = stringResource(R.string.rating_subtitle, uiState.runnerName),
                            fontSize = 14.sp,
                            color = ForerunTextMuted,
                            textAlign = TextAlign.Center
                        )
                    }
                }

                // 24h Expiration Warning
                if (uiState.isExpired) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(Dimens.RadiusMedium),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFEBEE))
                    ) {
                        Text(
                            text = stringResource(R.string.rating_expired_warning),
                            fontSize = 13.sp,
                            color = ForerunDanger,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(Dimens.Space12),
                            textAlign = TextAlign.Center
                        )
                    }
                }

                // Star Rating Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(Dimens.RadiusLarge),
                    colors = CardDefaults.cardColors(containerColor = ForerunSurface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(Dimens.Space20),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // 5 Stars Row
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(Dimens.Space12),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            for (star in 1..5) {
                                val isSelected = star <= uiState.stars
                                Icon(
                                    imageVector = if (isSelected) Icons.Filled.Star else Icons.Outlined.Star,
                                    contentDescription = "$star",
                                    tint = if (isSelected) Color(0xFFFFB300) else ForerunTextMuted,
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(CircleShape)
                                        .clickable(enabled = !uiState.isExpired && !uiState.isSubmitting) {
                                            viewModel.onIntent(RatingIntent.SetStars(star))
                                        }
                                        .padding(4.dp)
                                )
                            }
                        }

                        // Star description text
                        AnimatedVisibility(visible = uiState.stars > 0) {
                            val starLabel = when (uiState.stars) {
                                1 -> stringResource(R.string.rating_score_1)
                                2 -> stringResource(R.string.rating_score_2)
                                3 -> stringResource(R.string.rating_score_3)
                                4 -> stringResource(R.string.rating_score_4)
                                5 -> stringResource(R.string.rating_score_5)
                                else -> ""
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Spacer(modifier = Modifier.height(Dimens.Space8))
                                Text(
                                    text = starLabel,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = ForerunGreenDark
                                )
                            }
                        }
                    }
                }

                // Note Input Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(Dimens.RadiusLarge),
                    colors = CardDefaults.cardColors(containerColor = ForerunSurface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(Dimens.Space16)
                    ) {
                        Text(
                            text = stringResource(R.string.rating_note_label),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ForerunTextPrimary
                        )
                        Spacer(modifier = Modifier.height(Dimens.Space8))

                        OutlinedTextField(
                            value = uiState.note,
                            onValueChange = { newNote ->
                                if (newNote.length <= 1000) {
                                    viewModel.onIntent(RatingIntent.SetNote(newNote))
                                }
                            },
                            enabled = !uiState.isExpired && !uiState.isSubmitting,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp),
                            placeholder = {
                                Text(
                                    text = stringResource(R.string.rating_note_hint),
                                    fontSize = 13.sp,
                                    color = ForerunTextMuted
                                )
                            },
                            shape = RoundedCornerShape(Dimens.RadiusMedium),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = ForerunGreen,
                                unfocusedBorderColor = ForerunSoftSurface
                            )
                        )
                    }
                }

                // Submit Button
                Button(
                    onClick = { viewModel.onIntent(RatingIntent.Submit) },
                    enabled = uiState.stars > 0 && !uiState.isExpired && !uiState.isSubmitting,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(Dimens.ButtonHeightLarge),
                    shape = RoundedCornerShape(Dimens.RadiusPill),
                    colors = ButtonDefaults.buttonColors(containerColor = ForerunGreen)
                ) {
                    if (uiState.isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = if (uiState.isExistingRating) {
                                stringResource(R.string.rating_update_btn)
                            } else {
                                stringResource(R.string.rating_submit_btn)
                            },
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(Dimens.Space16))
            }
        }
    }
}
