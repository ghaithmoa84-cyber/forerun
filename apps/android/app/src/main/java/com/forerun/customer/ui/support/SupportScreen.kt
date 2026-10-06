package com.forerun.customer.ui.support

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.forerun.customer.R
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary
import com.forerun.customer.ui.theme.WhatsAppGreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportScreen(
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SupportViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.support_screen_title),
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = ForerunTextPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.label_back),
                            tint = ForerunTextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = ForerunSurface
                )
            )
        },
        containerColor = ForerunBackground,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        modifier = modifier
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = Dimens.Space16),
            verticalArrangement = Arrangement.spacedBy(Dimens.Space16)
        ) {
            item {
                Spacer(modifier = Modifier.height(Dimens.Space8))

                // WhatsApp Contact Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(Dimens.RadiusMedium),
                    colors = CardDefaults.cardColors(containerColor = ForerunSurface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
                ) {
                    Column(
                        modifier = Modifier.padding(Dimens.Space16),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(ForerunGreenLight),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Phone,
                                contentDescription = null,
                                tint = ForerunGreen,
                                modifier = Modifier.size(28.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(Dimens.Space12))

                        Text(
                            text = stringResource(R.string.support_whatsapp_card_title),
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = ForerunTextPrimary
                        )

                        Spacer(modifier = Modifier.height(Dimens.Space4))

                        Text(
                            text = stringResource(R.string.support_whatsapp_card_desc),
                            fontSize = 13.sp,
                            color = ForerunTextMuted,
                            lineHeight = 20.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(Dimens.Space16))

                        Button(
                            onClick = {
                                val url = viewModel.getWhatsAppUrl()
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                try {
                                    context.startActivity(intent)
                                } catch (_: Exception) {
                                    // Fallback
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(Dimens.ButtonHeight),
                            shape = RoundedCornerShape(Dimens.RadiusMedium),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = WhatsAppGreen,
                                contentColor = ForerunTextOnPrimary
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Phone,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(Dimens.Space8))
                            Text(
                                text = stringResource(R.string.support_whatsapp_button),
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(Dimens.Space12))

                        Text(
                            text = stringResource(R.string.support_working_hours),
                            fontSize = 12.sp,
                            color = ForerunTextMuted,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }

            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = Dimens.Space8, bottom = Dimens.Space4)
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = ForerunGreen,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = stringResource(R.string.support_faq_title),
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = ForerunTextPrimary
                    )
                }
            }

            items(uiState.faqs, key = { it.id }) { faq ->
                FaqCard(
                    faq = faq,
                    onToggle = { viewModel.toggleFaq(faq.id) }
                )
            }

            item {
                Spacer(modifier = Modifier.height(Dimens.Space24))
            }
        }
    }
}

@Composable
private fun FaqCard(
    faq: FaqItem,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle),
        shape = RoundedCornerShape(Dimens.RadiusMedium),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (faq.isExpanded) ForerunGreen.copy(alpha = 0.5f) else ForerunBorder
        )
    ) {
        Column(
            modifier = Modifier.padding(Dimens.Space16)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = faq.question,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    color = if (faq.isExpanded) ForerunGreen else ForerunTextPrimary,
                    modifier = Modifier.weight(1f)
                )
                Icon(
                    imageVector = if (faq.isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    contentDescription = null,
                    tint = if (faq.isExpanded) ForerunGreen else ForerunTextMuted,
                    modifier = Modifier.size(22.dp)
                )
            }

            AnimatedVisibility(
                visible = faq.isExpanded,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Column {
                    Spacer(modifier = Modifier.height(Dimens.Space8))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(ForerunBorder.copy(alpha = 0.5f))
                    )
                    Spacer(modifier = Modifier.height(Dimens.Space8))
                    Text(
                        text = faq.answer,
                        fontSize = 13.sp,
                        color = ForerunTextMuted,
                        lineHeight = 22.sp
                    )
                }
            }
        }
    }
}
