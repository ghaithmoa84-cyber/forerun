package com.forerun.customer.ui.address

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
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
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import kotlinx.coroutines.launch
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.forerun.customer.R
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenDark
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunOrange
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.rememberCameraPositionState

private const val TAG = "AddressSetupScreen"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddressSetupScreen(
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: AddressSetupViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    @StringRes var mapLoadError by rememberSaveable { mutableStateOf<Int?>(null) }
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(LatLng(uiState.lat, uiState.lng), 14.5f)
    }

    var isInitialPositionSet by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(uiState.lat, uiState.lng, uiState.isEditMode) {
        if (!isInitialPositionSet && uiState.isEditMode) {
            cameraPositionState.position = CameraPosition.fromLatLngZoom(LatLng(uiState.lat, uiState.lng), 14.5f)
            isInitialPositionSet = true
        }
    }

    LaunchedEffect(cameraPositionState.isMoving) {
        if (!cameraPositionState.isMoving) {
            val target = cameraPositionState.position.target
            viewModel.onIntent(AddressSetupIntent.UpdateCoordinates(target.latitude, target.longitude))
        }
    }

    LaunchedEffect(viewModel.events) {
        viewModel.events.collect { event ->
            when (event) {
                is AddressSetupEvent.AddressSaved -> {
                    snackbarHostState.showSnackbar(
                        context.getString(R.string.address_success_message)
                    )
                    onNavigateBack()
                }
                is AddressSetupEvent.ShowToast -> {
                    snackbarHostState.showSnackbar(event.message)
                }
            }
        }
    }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onIntent(AddressSetupIntent.ClearError)
        }
    }

    // Permission launcher for GPS location
    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    val gpsRequiredMessage = stringResource(R.string.address_gps_required)
    val locationPrecisionMessage = stringResource(R.string.address_location_precision)

    fun fetchLocation() {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
        val isGpsEnabled = locationManager?.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) == true ||
            locationManager?.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER) == true

        if (!isGpsEnabled) {
            coroutineScope.launch {
                snackbarHostState.showSnackbar(gpsRequiredMessage)
            }
        }

        try {
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { location ->
                    if (location != null) {
                        val target = LatLng(location.latitude, location.longitude)
                        viewModel.onIntent(
                            AddressSetupIntent.UpdateCoordinates(location.latitude, location.longitude)
                        )
                        coroutineScope.launch {
                            cameraPositionState.animate(
                                CameraUpdateFactory.newLatLngZoom(target, 15.0f)
                            )
                        }
                    } else {
                        fusedLocationClient.lastLocation.addOnSuccessListener { lastLoc ->
                            if (lastLoc != null) {
                                val target = LatLng(lastLoc.latitude, lastLoc.longitude)
                                viewModel.onIntent(
                                    AddressSetupIntent.UpdateCoordinates(lastLoc.latitude, lastLoc.longitude)
                                )
                                coroutineScope.launch {
                                    cameraPositionState.animate(
                                        CameraUpdateFactory.newLatLngZoom(target, 15.0f)
                                    )
                                }
                            } else {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar(locationPrecisionMessage)
                                }
                            }
                        }
                    }
                }
                .addOnFailureListener { e ->
                    Log.w(TAG, "Failed to get current location", e)
                }
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission denied", e)
        }
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fineGranted || coarseGranted) {
            fetchLocation()
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (uiState.isEditMode) {
                            stringResource(R.string.address_setup_title_edit)
                        } else {
                            stringResource(R.string.address_setup_title)
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = ForerunTextPrimary
                    )
                },
                navigationIcon = {
                    Box(modifier = Modifier.padding(start = Dimens.Space8)) {
                        IconButton(
                            onClick = onNavigateBack,
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(ForerunSoftSurface)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = stringResource(R.string.label_close),
                                tint = ForerunTextPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = ForerunSurface
                )
            )
        }
    ) { innerPadding ->
        var bottomCardHeightPx by remember { mutableIntStateOf(0) }
        val density = LocalDensity.current
        val bottomCardHeightDp = with(density) { bottomCardHeightPx.toDp() }
        val pinBottomPadding = if (bottomCardHeightDp > 0.dp) bottomCardHeightDp else 200.dp

        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = ForerunGreen)
                }
            } else {
                // Map Container
                if (mapLoadError != null) {
                    // Fallback placeholder if emulator GPU/OpenGL fails
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(ForerunSoftSurface)
                            .padding(Dimens.Space16),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = ForerunGreenDark,
                                modifier = Modifier.size(56.dp)
                            )
                            Spacer(modifier = Modifier.height(Dimens.Space8))
                            Text(
                                text = stringResource(mapLoadError ?: R.string.address_map_fallback_note),
                                textAlign = TextAlign.Center,
                                fontSize = 14.sp,
                                color = ForerunTextMuted
                            )
                            Spacer(modifier = Modifier.height(Dimens.Space8))
                            Text(
                                text = stringResource(
                                    R.string.address_coords_format,
                                    uiState.lat,
                                    uiState.lng
                                ),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ForerunTextPrimary
                            )
                        }
                    }
                } else {
                    GoogleMap(
                        modifier = Modifier.fillMaxSize(),
                        cameraPositionState = cameraPositionState,
                        uiSettings = remember {
                            MapUiSettings(
                                compassEnabled = false,
                                myLocationButtonEnabled = false,
                                mapToolbarEnabled = false,
                                rotationGesturesEnabled = true,
                                scrollGesturesEnabled = true,
                                tiltGesturesEnabled = false,
                                zoomGesturesEnabled = true
                            )
                        }
                    )

                    // Centered Pulsing Mint Pin Overlay (centered dynamically above bottom card)
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(bottom = pinBottomPadding),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.size(56.dp)
                            ) {
                                // Pulse ground halo
                                Box(
                                    modifier = Modifier
                                        .size(52.dp)
                                        .clip(CircleShape)
                                        .background(ForerunGreen.copy(alpha = 0.28f))
                                )
                                Icon(
                                    imageVector = Icons.Default.LocationOn,
                                    contentDescription = stringResource(R.string.label_selected_delivery_location),
                                    tint = ForerunGreenDark,
                                    modifier = Modifier.size(46.dp)
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .size(10.dp, 4.dp)
                                    .clip(CircleShape)
                                    .background(Color.Black.copy(alpha = 0.25f))
                            )
                        }
                    }

                    // Floating GPS Button
                    FloatingActionButton(
                        onClick = {
                            val fineCheck = ContextCompat.checkSelfPermission(
                                context,
                                Manifest.permission.ACCESS_FINE_LOCATION
                            )
                            val coarseCheck = ContextCompat.checkSelfPermission(
                                context,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                            if (fineCheck == PackageManager.PERMISSION_GRANTED ||
                                coarseCheck == PackageManager.PERMISSION_GRANTED
                            ) {
                                fetchLocation()
                            } else {
                                locationPermissionLauncher.launch(
                                    arrayOf(
                                        Manifest.permission.ACCESS_FINE_LOCATION,
                                        Manifest.permission.ACCESS_COARSE_LOCATION
                                    )
                                )
                            }
                        },
                        containerColor = ForerunSurface,
                        contentColor = ForerunGreen,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(Dimens.Space16)
                            .size(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Place,
                            contentDescription = stringResource(R.string.address_current_location),
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    // Floating Coordinates Badge
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(top = Dimens.Space16)
                            .clip(RoundedCornerShape(Dimens.RadiusPill))
                            .background(ForerunSurface.copy(alpha = 0.92f))
                            .border(1.dp, ForerunBorder, RoundedCornerShape(Dimens.RadiusPill))
                            .padding(horizontal = Dimens.Space12, vertical = Dimens.Space4)
                    ) {
                        Text(
                            text = stringResource(
                                R.string.address_coords_format,
                                uiState.lat,
                                uiState.lng
                            ),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = ForerunTextPrimary
                        )
                    }
                }

                // Bottom Sheet / Card with Address Details & Action (20dp corners)
                Card(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .imePadding()
                        .onGloballyPositioned { coordinates ->
                            bottomCardHeightPx = coordinates.size.height
                        }
                        .shadow(12.dp, shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)),
                    shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
                    colors = CardDefaults.cardColors(containerColor = ForerunSurface)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(Dimens.Space16)
                    ) {
                        // Title / Subtitle
                        Text(
                            text = if (uiState.isEditMode) {
                                stringResource(R.string.address_setup_subtitle_edit)
                            } else {
                                stringResource(R.string.address_setup_subtitle_new)
                            },
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ForerunTextPrimary
                        )

                        Spacer(modifier = Modifier.height(Dimens.Space4))

                        Text(
                            text = stringResource(R.string.address_permanent_note),
                            fontSize = 12.sp,
                            color = ForerunTextMuted
                        )

                        Spacer(modifier = Modifier.height(Dimens.Space10))

                        // Description Field
                        OutlinedTextField(
                            value = uiState.description,
                            onValueChange = { viewModel.onIntent(AddressSetupIntent.UpdateDescription(it)) },
                            label = { Text(stringResource(R.string.address_description_label)) },
                            placeholder = { Text(stringResource(R.string.address_description_hint), fontSize = 13.sp) },
                            isError = uiState.descriptionError != null,
                            trailingIcon = {
                                if (uiState.isGeocodingLoading) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(18.dp),
                                        strokeWidth = 2.dp,
                                        color = ForerunGreen
                                    )
                                }
                            },
                            supportingText = {
                                when {
                                    uiState.descriptionError != null -> {
                                        Text(
                                            text = uiState.descriptionError ?: "",
                                            color = ForerunDanger,
                                            fontSize = 12.sp
                                        )
                                    }
                                    uiState.isGeocodingLoading -> {
                                        Text(
                                            text = stringResource(R.string.address_locating),
                                            color = ForerunGreen,
                                            fontSize = 12.sp
                                        )
                                    }
                                    uiState.geocodingError != null -> {
                                        Text(
                                            text = stringResource(R.string.address_locate_failed_manual),
                                            color = ForerunTextMuted,
                                            fontSize = 12.sp
                                        )
                                    }
                                }
                            },
                            maxLines = 3,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(Dimens.RadiusMedium),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = ForerunOrange,
                                focusedLabelColor = ForerunOrange,
                                cursorColor = ForerunOrange
                            )
                        )

                        Spacer(modifier = Modifier.height(Dimens.Space8))

                        // Submit Button
                        Button(
                            onClick = { viewModel.onIntent(AddressSetupIntent.SaveAddress) },
                            enabled = !uiState.isSaving,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(Dimens.ButtonHeight),
                            shape = RoundedCornerShape(Dimens.RadiusMedium),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = ForerunOrange,
                                contentColor = ForerunTextOnPrimary
                            )
                        ) {
                            if (uiState.isSaving) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(22.dp),
                                    color = ForerunTextOnPrimary,
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(Dimens.Space8))
                                Text(
                                    text = stringResource(R.string.address_saving_button),
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            } else {
                                Text(
                                    text = stringResource(R.string.address_save_button),
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

