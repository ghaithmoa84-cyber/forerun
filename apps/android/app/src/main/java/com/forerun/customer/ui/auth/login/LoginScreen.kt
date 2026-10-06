package com.forerun.customer.ui.auth.login

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.forerun.customer.R
import com.forerun.customer.domain.model.User
import com.forerun.customer.domain.model.UserStatus
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunDangerLight
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenDark
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary

@Composable
fun LoginScreen(
    onNavigateToHome: () -> Unit,
    onNavigateToPending: () -> Unit,
    onNavigateToSuspended: () -> Unit,
    onNavigateToRegister: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current
    var passwordVisible by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(viewModel) {
        viewModel.navigationEvent.collect { event ->
            when (event) {
                is LoginNavigationEvent.Success -> {
                    when (event.user.status) {
                        UserStatus.VERIFIED -> onNavigateToHome()
                        UserStatus.PENDING_VERIFICATION -> onNavigateToPending()
                        UserStatus.SUSPENDED -> onNavigateToSuspended()
                        else -> onNavigateToHome()
                    }
                }
                is LoginNavigationEvent.NavigateToRegister -> onNavigateToRegister()
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ForerunBackground)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dimens.ScreenMargin, vertical = Dimens.Space24),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(Dimens.Space32))

        // Branding
        Image(
            painter = painterResource(id = R.drawable.logo),
            contentDescription = stringResource(R.string.app_name),
            modifier = Modifier.size(48.dp)
        )

        Spacer(modifier = Modifier.height(Dimens.Space8))

        Text(
            text = stringResource(R.string.app_name),
            fontSize = 30.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunGreenDark
        )

        Spacer(modifier = Modifier.height(Dimens.Space8))

        Text(
            text = stringResource(R.string.login_title),
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunTextPrimary
        )

        Spacer(modifier = Modifier.height(Dimens.Space4))

        Text(
            text = stringResource(R.string.login_subtitle),
            fontSize = 14.sp,
            color = ForerunTextMuted
        )

        Spacer(modifier = Modifier.height(Dimens.Space32))

        // General Error Banner
        if (state.generalError != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ForerunDangerLight, RoundedCornerShape(Dimens.RadiusMedium))
                    .padding(Dimens.Space12)
            ) {
                Text(
                    text = state.generalError!!,
                    color = ForerunDanger,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            Spacer(modifier = Modifier.height(Dimens.Space16))
        }

        // WhatsApp Phone Input
        OutlinedTextField(
            value = state.whatsapp,
            onValueChange = viewModel::onWhatsappChanged,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.phone_number_label)) },
            placeholder = { Text(stringResource(R.string.phone_number_hint)) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Phone,
                    contentDescription = null,
                    tint = ForerunTextMuted
                )
            },
            isError = state.whatsappErrorRes != null,
            supportingText = state.whatsappErrorRes?.let {
                { Text(stringResource(it), color = ForerunDanger) }
            },
            singleLine = true,
            shape = RoundedCornerShape(Dimens.RadiusMedium),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Phone,
                imeAction = ImeAction.Next
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) }
            ),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = ForerunGreen,
                unfocusedBorderColor = ForerunBorder,
                focusedContainerColor = ForerunSoftSurface,
                unfocusedContainerColor = ForerunSoftSurface
            )
        )

        Spacer(modifier = Modifier.height(Dimens.Space16))

        // Password Input
        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::onPasswordChanged,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.password_label)) },
            placeholder = { Text(stringResource(R.string.password_hint)) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = null,
                    tint = ForerunTextMuted
                )
            },
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Text(
                        text = if (passwordVisible) stringResource(R.string.label_hide) else stringResource(R.string.label_show),
                        fontSize = 12.sp,
                        color = ForerunTextMuted
                    )
                }
            },
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            isError = state.passwordErrorRes != null,
            supportingText = state.passwordErrorRes?.let {
                { Text(stringResource(it), color = ForerunDanger) }
            },
            singleLine = true,
            shape = RoundedCornerShape(Dimens.RadiusMedium),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(
                onDone = {
                    focusManager.clearFocus()
                    viewModel.login()
                }
            ),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = ForerunGreen,
                unfocusedBorderColor = ForerunBorder,
                focusedContainerColor = ForerunSoftSurface,
                unfocusedContainerColor = ForerunSoftSurface
            )
        )

        Spacer(modifier = Modifier.height(Dimens.Space24))

        // Login Button
        Button(
            onClick = {
                focusManager.clearFocus()
                viewModel.login()
            },
            enabled = !state.isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(Dimens.ButtonHeight),
            shape = RoundedCornerShape(Dimens.RadiusMedium),
            colors = ButtonDefaults.buttonColors(
                containerColor = ForerunGreen,
                contentColor = ForerunTextOnPrimary
            )
        ) {
            if (state.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = ForerunTextOnPrimary,
                    strokeWidth = 2.5.dp
                )
            } else {
                Text(
                    text = stringResource(R.string.login_button),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space24))

        // Don't have account? Register
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = stringResource(R.string.dont_have_account),
                fontSize = 14.sp,
                color = ForerunTextMuted
            )
            TextButton(onClick = viewModel::onRegisterClicked) {
                Text(
                    text = stringResource(R.string.register_action),
                    color = ForerunGreenDark,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
