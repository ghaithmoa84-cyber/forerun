package com.forerun.customer.ui.account

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
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.forerun.customer.R
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunDangerLight
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary
import java.text.NumberFormat
import java.util.Locale

@Composable
fun AccountScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToAddressSetup: () -> Unit = {},
    onNavigateToSupport: () -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: AccountViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    var nameInput by rememberSaveable { mutableStateOf("") }
    var altPhoneInput by rememberSaveable { mutableStateOf("") }
    var isInitialized by rememberSaveable { mutableStateOf(false) }

    var isPasswordExpanded by rememberSaveable { mutableStateOf(false) }
    var newPasswordInput by rememberSaveable { mutableStateOf("") }
    var confirmPasswordInput by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(uiState.profile) {
        uiState.profile?.let { profile ->
            if (!isInitialized) {
                nameInput = profile.name
                altPhoneInput = profile.altPhone ?: ""
                isInitialized = true
            }
        }
    }

    LaunchedEffect(viewModel) {
        viewModel.navigateToLogin.collect {
            onNavigateToLogin()
        }
    }

    val scrollState = rememberScrollState()

    if (uiState.isLoading && uiState.profile == null) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(ForerunBackground),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = ForerunGreen)
        }
        return
    }

    val loadError = uiState.loadErrorMessage
    if (loadError != null && uiState.profile == null) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(ForerunBackground)
                .padding(Dimens.Space16),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = ForerunDanger,
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(Dimens.Space12))
                Text(
                    text = loadError,
                    fontSize = 15.sp,
                    color = ForerunTextPrimary,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(Dimens.Space16))
                Button(
                    onClick = { viewModel.loadAccountData() },
                    colors = ButtonDefaults.buttonColors(containerColor = ForerunGreen)
                ) {
                    Text(stringResource(R.string.home_retry))
                }
            }
        }
        return
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ForerunBackground)
            .verticalScroll(scrollState)
            .padding(horizontal = Dimens.Space16, vertical = Dimens.Space16),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Dimens.Space16)
    ) {
        // User Profile Header Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(Dimens.RadiusMedium),
            colors = CardDefaults.cardColors(containerColor = ForerunSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(Dimens.Space16),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(ForerunGreenLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        tint = ForerunGreen,
                        modifier = Modifier.size(40.dp)
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space8))

                Text(
                    text = uiState.profile?.name ?: stringResource(R.string.account_title),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )

                Spacer(modifier = Modifier.height(Dimens.Space4))

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = ForerunGreen,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space4))
                    Text(
                        text = stringResource(R.string.account_verified_badge),
                        fontSize = 13.sp,
                        color = ForerunGreen,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space16))

                // Stats Row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Dimens.RadiusSmall))
                        .background(ForerunBackground)
                        .padding(vertical = Dimens.Space12, horizontal = Dimens.Space16),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "${uiState.profile?.completedOrders ?: 0}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = ForerunTextPrimary
                        )
                        Text(
                            text = stringResource(R.string.home_completed_orders),
                            fontSize = 12.sp,
                            color = ForerunTextMuted
                        )
                    }

                    Box(
                        modifier = Modifier
                            .width(1.dp)
                            .height(32.dp)
                            .background(ForerunBorder)
                    )

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        val formattedFees = NumberFormat.getNumberInstance(Locale.US)
                            .format(uiState.profile?.totalFeesPaid ?: 0)
                        Text(
                            text = "$formattedFees ${stringResource(R.string.home_currency)}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = ForerunGreen
                        )
                        Text(
                            text = stringResource(R.string.home_total_fees),
                            fontSize = 12.sp,
                            color = ForerunTextMuted
                        )
                    }
                }
            }
        }

        // Banners (Success & Error Messages)
        if (uiState.errorMessage != null || uiState.loadErrorMessage != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(Dimens.RadiusSmall),
                colors = CardDefaults.cardColors(containerColor = ForerunDangerLight)
            ) {
                Row(
                    modifier = Modifier.padding(Dimens.Space12),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = ForerunDanger,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = uiState.loadErrorMessage ?: uiState.errorMessage ?: "",
                        color = ForerunDanger,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f)
                    )
                    // Only the load failure is recoverable here; validation and
                    // save errors need the user to edit their input first.
                    if (uiState.loadErrorMessage != null) {
                        Spacer(modifier = Modifier.width(Dimens.Space8))
                        TextButton(
                            onClick = { viewModel.loadAccountData() },
                            contentPadding = PaddingValues(horizontal = Dimens.Space8, vertical = 0.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.home_retry),
                                color = ForerunDanger,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        if (uiState.profileSuccessMessage != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(Dimens.RadiusSmall),
                colors = CardDefaults.cardColors(containerColor = ForerunGreenLight)
            ) {
                Row(
                    modifier = Modifier.padding(Dimens.Space12),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = ForerunGreen,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = uiState.profileSuccessMessage ?: "",
                        color = ForerunGreen,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        if (uiState.passwordSuccessMessage != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(Dimens.RadiusSmall),
                colors = CardDefaults.cardColors(containerColor = ForerunGreenLight)
            ) {
                Row(
                    modifier = Modifier.padding(Dimens.Space12),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = ForerunGreen,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = uiState.passwordSuccessMessage ?: "",
                        color = ForerunGreen,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Section 1: Personal Info (name, altPhone, whatsapp)
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(Dimens.RadiusMedium),
            colors = CardDefaults.cardColors(containerColor = ForerunSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
        ) {
            Column(
                modifier = Modifier.padding(Dimens.Space16),
                verticalArrangement = Arrangement.spacedBy(Dimens.Space12)
            ) {
                Text(
                    text = stringResource(R.string.account_section_profile),
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = ForerunTextPrimary
                )

                // Name field
                OutlinedTextField(
                    value = nameInput,
                    onValueChange = {
                        nameInput = it
                        viewModel.clearMessages()
                    },
                    label = { Text(stringResource(R.string.name_label)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(Dimens.RadiusSmall),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ForerunGreen,
                        unfocusedBorderColor = ForerunBorder
                    ),
                    singleLine = true
                )

                // WhatsApp number (read-only)
                OutlinedTextField(
                    value = uiState.profile?.whatsapp ?: "",
                    onValueChange = {},
                    readOnly = true,
                    enabled = false,
                    label = { Text(stringResource(R.string.phone_number_label)) },
                    supportingText = {
                        Text(
                            text = stringResource(R.string.account_whatsapp_note),
                            fontSize = 11.sp,
                            color = ForerunTextMuted
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(Dimens.RadiusSmall),
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledBorderColor = ForerunBorder,
                        disabledTextColor = ForerunTextMuted
                    ),
                    singleLine = true
                )

                // Alt phone field
                OutlinedTextField(
                    value = altPhoneInput,
                    onValueChange = {
                        altPhoneInput = it
                        viewModel.clearMessages()
                    },
                    label = { Text(stringResource(R.string.alt_phone_label)) },
                    placeholder = { Text(stringResource(R.string.alt_phone_hint)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(Dimens.RadiusSmall),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ForerunGreen,
                        unfocusedBorderColor = ForerunBorder
                    ),
                    singleLine = true
                )

                Button(
                    onClick = {
                        viewModel.updateProfile(nameInput, altPhoneInput)
                    },
                    enabled = !uiState.isSavingProfile,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(Dimens.ButtonHeight),
                    shape = RoundedCornerShape(Dimens.RadiusSmall),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ForerunGreen,
                        contentColor = ForerunTextOnPrimary
                    )
                ) {
                    if (uiState.isSavingProfile) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = ForerunTextOnPrimary,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(Dimens.Space8))
                        Text(stringResource(R.string.account_saving))
                    } else {
                        Text(
                            text = stringResource(R.string.account_save_profile),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Section 2: Change Password Card (Expandable)
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(Dimens.RadiusMedium),
            colors = CardDefaults.cardColors(containerColor = ForerunSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
        ) {
            Column(
                modifier = Modifier.padding(Dimens.Space16)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { isPasswordExpanded = !isPasswordExpanded },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = null,
                            tint = ForerunGreen,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(Dimens.Space8))
                        Text(
                            text = stringResource(R.string.account_section_password),
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = ForerunTextPrimary
                        )
                    }
                    Icon(
                        imageVector = if (isPasswordExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = null,
                        tint = ForerunTextMuted
                    )
                }

                AnimatedVisibility(
                    visible = isPasswordExpanded,
                    enter = expandVertically() + fadeIn(),
                    exit = shrinkVertically() + fadeOut()
                ) {
                    Column(
                        modifier = Modifier.padding(top = Dimens.Space16),
                        verticalArrangement = Arrangement.spacedBy(Dimens.Space12)
                    ) {
                        OutlinedTextField(
                            value = newPasswordInput,
                            onValueChange = {
                                newPasswordInput = it
                                viewModel.clearMessages()
                            },
                            label = { Text(stringResource(R.string.account_new_password_label)) },
                            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                            trailingIcon = {
                                IconButton(onClick = { showPassword = !showPassword }) {
                                    Text(
                                        text = if (showPassword) stringResource(R.string.label_hide) else stringResource(R.string.label_show),
                                        fontSize = 12.sp,
                                        color = ForerunTextMuted
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(Dimens.RadiusSmall),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = ForerunGreen,
                                unfocusedBorderColor = ForerunBorder
                            ),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = confirmPasswordInput,
                            onValueChange = {
                                confirmPasswordInput = it
                                viewModel.clearMessages()
                            },
                            label = { Text(stringResource(R.string.account_confirm_password_label)) },
                            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(Dimens.RadiusSmall),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = ForerunGreen,
                                unfocusedBorderColor = ForerunBorder
                            ),
                            singleLine = true
                        )

                        Button(
                            onClick = {
                                viewModel.changePassword(newPasswordInput, confirmPasswordInput)
                            },
                            enabled = !uiState.isChangingPassword && newPasswordInput.isNotBlank(),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(Dimens.ButtonHeight),
                            shape = RoundedCornerShape(Dimens.RadiusSmall),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = ForerunGreen,
                                contentColor = ForerunTextOnPrimary
                            )
                        ) {
                            if (uiState.isChangingPassword) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = ForerunTextOnPrimary,
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(Dimens.Space8))
                                Text(stringResource(R.string.account_changing_password))
                            } else {
                                Text(
                                    text = stringResource(R.string.account_change_password_btn),
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }

        // Section 3: Delivery Address Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(Dimens.RadiusMedium),
            colors = CardDefaults.cardColors(containerColor = ForerunSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
        ) {
            Column(
                modifier = Modifier.padding(Dimens.Space16),
                verticalArrangement = Arrangement.spacedBy(Dimens.Space12)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = ForerunGreen,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = stringResource(R.string.account_section_address),
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = ForerunTextPrimary
                    )
                }

                Text(
                    text = uiState.address?.description ?: stringResource(R.string.account_no_address),
                    fontSize = 14.sp,
                    color = if (uiState.address != null) ForerunTextPrimary else ForerunTextMuted,
                    lineHeight = 20.sp
                )

                OutlinedButton(
                    onClick = onNavigateToAddressSetup,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(Dimens.RadiusSmall),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = ForerunGreen
                    ),
                    border = androidx.compose.foundation.BorderStroke(1.dp, ForerunGreen)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = stringResource(R.string.account_edit_address),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // Section 4: Support & FAQ Button Card
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onNavigateToSupport),
            shape = RoundedCornerShape(Dimens.RadiusMedium),
            colors = CardDefaults.cardColors(containerColor = ForerunSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
        ) {
            Row(
                modifier = Modifier.padding(Dimens.Space16),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(ForerunGreenLight),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Phone,
                            contentDescription = null,
                            tint = ForerunGreen,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(Dimens.Space12))

                    Column {
                        Text(
                            text = stringResource(R.string.account_support_button),
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = ForerunTextPrimary
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = stringResource(R.string.account_support_subtitle),
                            fontSize = 12.sp,
                            color = ForerunTextMuted
                        )
                    }
                }

                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = null,
                    tint = ForerunGreen,
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        // Section 5: Logout
        OutlinedButton(
            onClick = { viewModel.logout() },
            enabled = !uiState.isLoggingOut,
            modifier = Modifier
                .fillMaxWidth()
                .height(Dimens.ButtonHeight),
            shape = RoundedCornerShape(Dimens.RadiusSmall),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = ForerunDanger
            ),
            border = androidx.compose.foundation.BorderStroke(1.dp, ForerunDanger)
        ) {
            if (uiState.isLoggingOut) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = ForerunDanger,
                    strokeWidth = 2.dp
                )
            } else {
                Text(
                    text = stringResource(R.string.logout),
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space24))
    }
}
