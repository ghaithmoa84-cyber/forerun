package com.forerun.customer.ui.order.create

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.forerun.customer.R
import com.forerun.customer.domain.model.PricingDisclosure
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunMintDark
import com.forerun.customer.ui.theme.ForerunMintLight
import com.forerun.customer.ui.theme.ForerunOrange
import com.forerun.customer.ui.theme.ForerunOrangeLight
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary

@Composable
fun FeeDisclosureDialog(
    pricing: PricingDisclosure?,
    isLoading: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = modifier,
        containerColor = ForerunSurface,
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(ForerunOrangeLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = ForerunOrange,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Text(
                    text = stringResource(R.string.fee_disclosure_title),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(Dimens.Space12)
            ) {
                if (isLoading) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Dimens.RadiusMedium))
                            .background(ForerunSoftSurface)
                            .padding(Dimens.Space8),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = ForerunOrange,
                            strokeWidth = 2.dp
                        )
                        Text(
                            text = stringResource(R.string.fee_disclosure_loading),
                            fontSize = 12.sp,
                            color = ForerunTextMuted
                        )
                    }
                }

                if (pricing?.freeOrdersPromoEnabled == true) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Dimens.RadiusMedium))
                            .background(ForerunMintLight)
                            .padding(Dimens.Space12)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(Dimens.Space8),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = ForerunMintDark,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = stringResource(R.string.fee_disclosure_free_promo_item),
                                fontSize = 13.sp,
                                lineHeight = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunMintDark
                            )
                        }
                    }
                }

                // Item 1: Peripheral Fee
                DisclosureItem(
                    index = 1,
                    text = if (pricing != null) {
                        stringResource(R.string.fee_disclosure_peripheral_text, pricing.peripheralFee)
                    } else {
                        stringResource(R.string.fee_disclosure_peripheral_fallback)
                    }
                )

                // Item 2: Extra Store Fee
                DisclosureItem(
                    index = 2,
                    text = if (pricing != null) {
                        stringResource(R.string.fee_disclosure_extra_store_text, pricing.extraStoreFee)
                    } else {
                        stringResource(R.string.fee_disclosure_extra_store_fallback)
                    }
                )

                // Item 3: Custom Fee Notice
                DisclosureItem(
                    index = 3,
                    text = stringResource(R.string.fee_disclosure_custom_fee_text)
                )

                // Item 4: Cancellation Right Policy
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Dimens.RadiusMedium))
                        .background(ForerunMintLight)
                        .padding(Dimens.Space12)
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(Dimens.Space8),
                        verticalAlignment = Alignment.Top
                    ) {
                        Box(
                            modifier = Modifier
                                .size(20.dp)
                                .clip(CircleShape)
                                .background(ForerunMintDark),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "4",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunSurface
                            )
                        }
                        Text(
                            text = stringResource(R.string.fee_disclosure_cancellation_text),
                            fontSize = 13.sp,
                            lineHeight = 19.sp,
                            fontWeight = FontWeight.Medium,
                            color = ForerunTextPrimary
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                shape = RoundedCornerShape(Dimens.RadiusMedium),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ForerunOrange,
                    contentColor = ForerunTextOnPrimary
                ),
                modifier = Modifier.padding(horizontal = Dimens.Space4)
            ) {
                Text(
                    text = stringResource(R.string.fee_disclosure_confirm_button),
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(Dimens.RadiusMedium),
                colors = ButtonDefaults.textButtonColors(
                    contentColor = ForerunTextMuted
                )
            ) {
                Text(
                    text = stringResource(R.string.fee_disclosure_cancel_button),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
            }
        }
    )
}

@Composable
private fun DisclosureItem(
    index: Int,
    text: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Dimens.Space8),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(ForerunSoftSurface),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = index.toString(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunTextPrimary
            )
        }
        Text(
            text = text,
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = ForerunTextPrimary,
            modifier = Modifier.weight(1f)
        )
    }
}
