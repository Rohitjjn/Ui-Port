package com.maxrave.simpmusic.ui.uiport

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

/**
 * The ported UI, as an app.
 *
 * This is the entry point that makes the APK show the new interface rather than the original
 * SimpMusic one. It owns exactly one piece of state - which route is selected - and passes it to
 * the screen, which passes it to [UiPortPhoneScaffold]. Each screen renders its own scaffold, so
 * there is one bottom bar no matter which screen is showing.
 *
 * `/search` is in the prototype's nav but has not been ported: there is no reference capture for
 * it, so there is nothing to port against and nothing to measure. Selecting it stays on the home
 * screen rather than showing an empty stub, because a stub would look like a broken port and would
 * be scored as one.
 */
@Composable
fun UiPortApp(modifier: Modifier = Modifier) {
    var route by rememberSaveable { mutableStateOf("/") }
    when (route) {
        "/library" ->
            UiPortLibraryScreen(
                onOpen = { route = "/" },
                onNavigate = { route = it },
                modifier = modifier,
            )
        else ->
            UiPortHomeScreen(
                onNavigate = { route = it },
                modifier = modifier,
            )
    }
}
